resource "aws_iam_role" "getmessages" {
  name = "GetMessages"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Sid    = ""
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      },
    ]
  })
  tags = {
    App         = "Receipt-Processor"
    Environment = var.environment
  } 
}

resource "aws_iam_policy" "getmessages" {
  name        = "${var.environment}-getmessages-policy"
  description = "Policy for GetMessages lambda"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:GetItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:BatchWriteItem"
        ]
        Resource = [
          var.table.arn,
          "${var.table.arn}/index/*"
        ]
      },
    ]
  })
}


resource "aws_iam_role_policy_attachment" "getmessages" {
  role       = aws_iam_role.getmessages.name
  policy_arn = aws_iam_policy.getmessages.arn
}