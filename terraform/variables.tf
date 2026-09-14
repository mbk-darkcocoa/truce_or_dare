variable "app_name" {
  type        = string
  description = "Display name for the Truce or Dare deployment."
  default     = "truce-or-dare"
}

variable "environment" {
  type        = string
  description = "Deployment environment label."
  default     = "development"
}

variable "public_url" {
  type        = string
  description = "Base public URL for the application."
  default     = "http://localhost:3000"
}

variable "app_port" {
  type        = number
  description = "Port used by the Node HTTP server."
  default     = 3000
}

variable "healthcheck_path" {
  type        = string
  description = "Path used for health checks."
  default     = "/health"
}

variable "data_store_path" {
  type        = string
  description = "Location of the JSON persistence file."
  default     = "/home/runner/work/truce_or_dare/truce_or_dare/data/store.json"
}

variable "enable_chat_ui" {
  type        = bool
  description = "Whether the deployment includes the chat UI."
  default     = true
}

variable "enable_ironclad" {
  type        = bool
  description = "Whether the deployment includes the Ironclad command center."
  default     = true
}
