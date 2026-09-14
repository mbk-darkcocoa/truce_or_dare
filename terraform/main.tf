terraform {
  required_version = ">= 1.5.0"
}

locals {
  ironclad_name = "Ironclad"

  app = {
    name           = var.app_name
    environment    = var.environment
    public_url     = var.public_url
    app_port       = var.app_port
    healthcheck    = "${var.public_url}${var.healthcheck_path}"
    data_store     = var.data_store_path
    chat_enabled   = var.enable_chat_ui
    ironclad_ready = var.enable_ironclad
  }
}
