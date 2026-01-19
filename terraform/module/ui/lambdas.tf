resource "aws_lambda_function" "getmessages" {
    filename                       = "${path.module}/../../../code/getmessages/getmessages.zip"
    function_name                  = "${var.environment}-getmessages"
    role                           = aws_iam_role.getmessages.arn
    runtime                        = "python3.14"
    handler = "lambda_function.lambda_handler"
    environment {
    variables = {
                 "TABLE_NAME" : var.table.name,
        }
    }
    timeout = 3
    tags = var.tags
}

resource "aws_lambda_permission" "apigw" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.getmessages.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.main.execution_arn}/*/*"
}