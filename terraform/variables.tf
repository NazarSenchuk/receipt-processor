variable "region"{}
variable "environment"{}
variable "tags"{}
variable "processing_config"{
    description = "Confgurations related to processing logic services"
}
variable "ui_config" {
  type = object({
    api_name      = string
    custom_domain = optional(string, "")  
  })
}