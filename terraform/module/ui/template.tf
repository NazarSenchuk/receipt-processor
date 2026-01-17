resource "local_file" "app_config" {
  filename = "${path.module}/../../../code/frontend/app-config.js"
  content = templatefile("${path.module}/templates/app-config.js.tpl", {
    aws_region   = var.region
    user_pool_id = aws_cognito_user_pool.main.id
    client_id    = aws_cognito_user_pool_client.web_client.id
    api_endpoint = aws_api_gateway_stage.main.invoke_url
  })
}