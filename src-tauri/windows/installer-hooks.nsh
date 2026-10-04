# Install/uninstall customization hooks. Keep macro bodies free of UI (MessageBox, DetailPrint)
# so `/S` silent installs required by the Microsoft Store never block.
# Hook reference: https://v2.tauri.app/distribute/windows-installer/#installer-hooks

# Privacy policy page data, referenced by the license page in installer.nsi.
# ${__FILEDIR__} is this file's directory, so the paths hold no matter where
# makensis runs. Language IDs: 2052 = SimpChinese, 1033 = English.
LicenseLangString MADPrivacy 2052 "${__FILEDIR__}\licenses\privacy-zh.rtf"
LicenseLangString MADPrivacy 1033 "${__FILEDIR__}\licenses\privacy-en.rtf"
LangString MADPrivacyTop 2052 "请阅读以下隐私政策。如你同意，请选择「我接受」并点击「下一步」继续安装。"
LangString MADPrivacyTop 1033 "Please read the privacy policy below. If you agree with it, select $\"I accept$\" and click Next to continue."
LangString MADPrivacyBottom 2052 "选择「我接受」即表示你同意本隐私政策的全部内容。"
LangString MADPrivacyBottom 1033 "Selecting $\"I accept$\" means that you agree to everything in this privacy policy."

!macro NSIS_HOOK_PREINSTALL
!macroend

!macro NSIS_HOOK_POSTINSTALL
!macroend

!macro NSIS_HOOK_PREUNINSTALL
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
!macroend
