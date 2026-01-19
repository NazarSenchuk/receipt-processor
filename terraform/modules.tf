module "processing"{
    source ="./module/processing"
    processing_config = var.processing_config
    environment = var.environment
    tags = var.tags
}

module "ui"{
    source ="./module/ui"
    table = module.processing.table
    ui_config = var.ui_config
    environment = var.environment
    region  = var.region
    tags = var.tags
}