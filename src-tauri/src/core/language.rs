//! 应用语言：settings.language → rust-i18n locale。
//! 前端切换语言时经 set_language 命令同步，后端错误消息等随全局 locale 本地化。

use serde::{Deserialize, Serialize};

/// 应用语言选择
#[derive(Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub(crate) enum LanguageChoice {
    #[default]
    Auto,
    Zh,
    En,
}

/// locale 以 zh 开头（含繁中）→ zh-CN，其余 → en。
fn system_locale() -> &'static str {
    let tag = sys_locale::get_locale()
        .unwrap_or_else(|| "en".to_string())
        .replace('_', "-")
        .to_lowercase();
    if tag.starts_with("zh") {
        "zh-CN"
    } else {
        "en"
    }
}

/// 解析语言选择并应用到 rust-i18n 全局 locale。
pub(crate) fn apply_language(choice: LanguageChoice) {
    let locale = match choice {
        LanguageChoice::Zh => "zh-CN",
        LanguageChoice::En => "en",
        LanguageChoice::Auto => system_locale(),
    };
    rust_i18n::set_locale(locale);
}
