# Install/uninstall customization hooks. Keep macro bodies free of UI (MessageBox, DetailPrint)
# so `/S` silent installs required by the Microsoft Store never block.
# Hook reference: https://v2.tauri.app/distribute/windows-installer/#installer-hooks
!macro NSIS_HOOK_PREINSTALL
!macroend

!macro NSIS_HOOK_POSTINSTALL
!macroend

!macro NSIS_HOOK_PREUNINSTALL
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
!macroend
