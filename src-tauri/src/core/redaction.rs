//! 通用文本脱敏：任务日志与诊断导出共享同一套规则。

fn strip_ansi_codes(line: &str) -> String {
    let mut output = String::with_capacity(line.len());
    let mut characters = line.chars().peekable();
    while let Some(character) = characters.next() {
        if character == '\u{1b}' && characters.peek() == Some(&'[') {
            characters.next();
            for code in characters.by_ref() {
                if code.is_ascii_alphabetic() {
                    break;
                }
            }
        } else {
            output.push(character);
        }
    }
    output
}

pub(crate) fn redact_output_line(line: &str) -> String {
    let mut redacted = strip_ansi_codes(line);
    for key in [
        "SESSDATA",
        "bili_jct",
        "access_token",
        "refresh_token",
        "authorization",
        "proxy-authorization",
        "password",
        "passwd",
        "passkey",
        "api_key",
        "api-key",
        "cookies",
        "cookie",
        "token",
    ] {
        let mut search_from = 0;
        while let Some(offset) = redacted[search_from..]
            .to_ascii_lowercase()
            .find(&key.to_ascii_lowercase())
        {
            let label_end = search_from + offset + key.len();
            let mut delimiter = label_end;
            while redacted[delimiter..].starts_with('"')
                || redacted[delimiter..].starts_with('\'')
                || redacted[delimiter..].starts_with(char::is_whitespace)
            {
                delimiter += redacted[delimiter..].chars().next().unwrap().len_utf8();
            }
            if !redacted[delimiter..].starts_with('=') && !redacted[delimiter..].starts_with(':') {
                search_from = label_end;
                continue;
            }
            delimiter += 1;
            while redacted[delimiter..].starts_with(char::is_whitespace) {
                delimiter += redacted[delimiter..].chars().next().unwrap().len_utf8();
            }
            let quote = redacted[delimiter..]
                .chars()
                .next()
                .filter(|character| *character == '"' || *character == '\'');
            let start = delimiter + quote.map(char::len_utf8).unwrap_or(0);
            let hide_remainder = matches!(
                key,
                "authorization" | "proxy-authorization" | "cookie" | "cookies"
            ) && quote.is_none();
            let end = if hide_remainder {
                redacted.len()
            } else {
                redacted[start..]
                    .find(|character: char| {
                        quote.map(|quote| character == quote).unwrap_or_else(|| {
                            character.is_whitespace() || matches!(character, ';' | '&' | '#')
                        })
                    })
                    .map(|value_offset| start + value_offset)
                    .unwrap_or(redacted.len())
            };
            redacted.replace_range(start..end, "***");
            search_from = start + 3;
        }
    }
    redacted
}

fn redact_uri_credentials(uri: &str, nested: bool) -> String {
    let Ok(mut url) = reqwest::Url::parse(uri) else {
        return uri.into();
    };
    let mut changed = false;
    if !url.username().is_empty() || url.password().is_some() {
        let _ = url.set_username("***");
        let _ = url.set_password(None);
        changed = true;
    }
    let magnet = url.scheme() == "magnet";
    let mut query_changed = false;
    let pairs: Vec<(String, String)> = url
        .query_pairs()
        .map(|(key, value)| {
            let masked = match key.to_ascii_lowercase().replace('-', "_").as_str() {
                "passkey" | "authkey" | "password" | "passwd" | "token" | "access_token"
                | "refresh_token" | "api_key" | "apikey" | "secret" | "authorization"
                | "cookie" | "sessdata" | "bili_jct" => "***".to_string(),
                "tr" if magnet && !nested => redact_uri_credentials(&value, true),
                _ => value.to_string(),
            };
            query_changed |= masked != value;
            (key.into_owned(), masked)
        })
        .collect();
    if query_changed {
        url.query_pairs_mut().clear().extend_pairs(pairs);
    }
    if changed || query_changed {
        url.into()
    } else {
        uri.into()
    }
}

/// 保留下载地址，仅隐藏 URL 中明确的凭据字段和用户名密码。
pub(crate) fn redact_sensitive_urls(line: &str) -> String {
    let mut result = String::new();
    let mut remaining = line;
    while !remaining.is_empty() {
        let lower = remaining.to_ascii_lowercase();
        let start = [
            "http://", "https://", "ftp://", "sftp://", "udp://", "magnet:",
        ]
        .iter()
        .filter_map(|prefix| lower.find(prefix))
        .min();
        let Some(start) = start else {
            result.push_str(remaining);
            break;
        };
        result.push_str(&remaining[..start]);
        remaining = &remaining[start..];
        let end = remaining
            .find(|c: char| c.is_whitespace() || matches!(c, '\'' | '"' | '<' | '>' | ','))
            .unwrap_or(remaining.len());
        result.push_str(&redact_uri_credentials(&remaining[..end], false));
        remaining = &remaining[end..];
    }
    result
}

pub(crate) fn sanitize_diagnostic_text(
    line: &str,
    redact_personal_data: bool,
    home: Option<&str>,
) -> String {
    let mut sanitized = redact_sensitive_urls(&redact_output_line(line));
    if redact_personal_data {
        if let Some(home) = home.filter(|value| !value.is_empty()) {
            sanitized = sanitized.replace(home, "$HOME");
        }
    }
    sanitized
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ordinary_urls_and_parameters_survive_diagnostics() {
        for line in [
            "magnet:?xt=urn:btih:0123456789012345678901234567890123456789&dn=example",
            "https://example.com/file.torrent?id=42&key=video&sig=checksum",
            "udp://tracker.invalid:80/community/announce",
            "[#abc123 1MiB/2MiB(50%) CN:1 DL:2MiB]",
        ] {
            assert_eq!(redact_sensitive_urls(line), line);
            assert_eq!(sanitize_diagnostic_text(line, true, None), line);
        }
    }

    #[test]
    fn explicit_credentials_are_masked_without_removing_urls() {
        for line in [
            "https://user:SECRET@host/file?id=42",
            "https://tracker.invalid/announce?passkey=SECRET&id=42",
            "magnet:?xt=urn:btih:0123456789012345678901234567890123456789&tr=https%3A%2F%2Ftracker.invalid%2Fannounce%3Fpasskey%3DSECRET",
            "udp://tracker.invalid/announce?passkey=SECRET,https://tracker.invalid/announce?token=SECRET",
            "Authorization: Bearer SECRET",
            "Cookie: session=SECRET",
        ] {
            let masked = sanitize_diagnostic_text(line, true, None);
            assert!(!masked.contains("SECRET"), "{masked}");
            assert_eq!(sanitize_diagnostic_text(&masked, true, None), masked);
            if line.contains("id=42") { assert!(masked.contains("id=42")); }
        }
    }
}
