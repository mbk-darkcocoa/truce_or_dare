output "deployment_manifest" {
  description = "Normalized deployment metadata for Truce or Dare."
  value       = local.app
}

output "ironclad_command_center" {
  description = "Ironclad control plane metadata."
  value = {
    name            = local.ironclad_name
    chat_ui_enabled = var.enable_chat_ui
    healthcheck     = local.app.healthcheck
    environment     = var.environment
  }
}
