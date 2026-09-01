//! bilibili 的 tauri command 薄壳（架构文档 §3 纪律：只做反序列化 → 调 adapter → 返回，
//! 出现 if-else 即业务逻辑外漏）。
//! 预览与提交走同一个 `adapter::plan` 调用——§5"所见即所执行"的结构性保证。

use tauri::{AppHandle, State};

use super::{adapter, login};
use crate::core::adapter::{preview_result, PreviewResult, SubmitResult};
use crate::core::deps::{command_path, resolve_tool, ToolName};
use crate::core::query::RunResult;
use crate::core::task::types::{CwdPolicy, Feature, TaskIntent};
use crate::core::task::{TaskHub, TaskSpec};

/// 原生扫码登录入口（旧 run_tool 的 ["login"] 特判归位为显式 command）。
/// 登录是"带自定义事件的长时查询"（§4.2 实施期修正），不进任务系统；
/// 生命周期事件沿用 job-state/bbdown-login-qr 通道。
#[tauri::command]
pub(crate) async fn bilibili_login_start(app: AppHandle) -> Result<RunResult, String> {
    let (executable, _) = resolve_tool(&app, &ToolName::Bbdown)
        .ok_or_else(|| rust_i18n::t!("backend.bilibili.commands.bbdown_not_found").to_string())?;
    let working_dir = login::bbdown_directory(&executable)?;
    login::spawn_bbdown_login_job(app, working_dir).await
}

/// 查询当前 B站登录态：读取本地 BBDown.data 并在线校验 Cookie 是否仍有效，
/// 供页头按钮区分「扫码登录 / 已登录」。
#[tauri::command]
pub(crate) async fn bilibili_login_status(app: AppHandle) -> Result<bool, String> {
    let (executable, _) = resolve_tool(&app, &ToolName::Bbdown)
        .ok_or_else(|| rust_i18n::t!("backend.bilibili.commands.bbdown_not_found").to_string())?;
    let working_dir = login::bbdown_directory(&executable)?;
    login::bbdown_login_status(&working_dir).await
}

#[tauri::command]
pub(crate) fn bilibili_logout(app: AppHandle) -> Result<(), String> {
    let (executable, _) = resolve_tool(&app, &ToolName::Bbdown)
        .ok_or_else(|| rust_i18n::t!("backend.bilibili.commands.bbdown_not_found").to_string())?;
    let working_dir = login::bbdown_directory(&executable)?;
    login::bbdown_logout(&working_dir)
}

#[tauri::command]
pub fn bilibili_preview(intent: TaskIntent) -> Result<PreviewResult, String> {
    let plan = adapter::plan(&intent).map_err(|e| e.to_string())?;
    Ok(preview_result(&plan))
}

#[tauri::command]
pub fn bilibili_submit(
    app: AppHandle,
    hub: State<'_, TaskHub>,
    intent: TaskIntent,
) -> Result<SubmitResult, String> {
    let plan = adapter::plan(&intent).map_err(|e| e.to_string())?;
    let (tool_path, _bundled) = resolve_tool(&app, &ToolName::Bbdown)
        .ok_or_else(|| rust_i18n::t!("backend.bilibili.commands.bbdown_not_found").to_string())?;
    let cwd = match plan.cwd {
        CwdPolicy::ExeDir => Some(login::bbdown_directory(&tool_path)?),
        CwdPolicy::Inherit => None,
        CwdPolicy::Explicit(dir) => Some(std::path::PathBuf::from(dir)),
    };
    let spec = TaskSpec {
        feature: Feature::Bilibili,
        pool: plan.pool,
        title: plan.title,
        tool: plan.tool.to_string(),
        tool_path,
        tool_version: None, // deps 阶段接入版本缓存后补充
        argv: plan.argv,
        argv_redacted: plan.argv_redacted,
        cwd,
        output_paths: plan.output_paths,
        env_path: Some(command_path()),
        // 落库的意图必须先脱敏（§4.5）；本次执行用的完整 argv 不受影响
        intent: adapter::sanitize_intent(&intent),
        parser: None, // BBDown 进度解析待样板后接入
        cleanup_dir: None,
    };
    Ok(SubmitResult {
        task_id: hub.submit(spec),
    })
}
