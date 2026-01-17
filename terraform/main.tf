terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

provider "aws" {
  region = var.region
}


module "processing"{
    source ="./module/processing"
    processing_config = var.processing_config
    environment = var.environment
}

module "ui"{
    source ="./module/ui"
    table = module.processing.table
    environment = var.environment
    region  = var.region
}