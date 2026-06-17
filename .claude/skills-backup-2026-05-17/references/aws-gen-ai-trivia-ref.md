# Gen AI Trivia

![alt text](images/frontend_1.png)

## Description
Gen AI Trivia is an interactive trivia application that generates questions and answers using artificial intelligence. It provides an engaging and educational experience for users to test their knowledge across various topics. Gen AI Trivia utilizes advanced natural language processing and machine learning techniques to generate unique and challenging trivia questions. The application consists of a backend API that handles question generation and a user-friendly frontend interface for users to interact with the trivia game.

## Architecture

![alt text](images/architecture.png)

## Folder Structure

The project's folder structure is organized as follows:

| Folder/File   | Description                                           |
|---------------|-------------------------------------------------------|
| `app/`        | Contains the application's infrastructure code that will be built and transformed within the CI/CD pipeline. |
| `configs/`    | Contains the application's deployment configurations. |
| `images/`     | Contains the images used within the README file.      |
| `pipeline/`   | Contains the application's infrastructure code for the CI/CD pipeline. |
| `res/electron/` | Contains the application's Electron settings file.  |
| `scripts/`    | Contains the scripts used to update configurations for the application. |
| `www/`        | Contains the frontend code and related files.         |
| `requirements.txt` | Pip requirements file for the deployment environment. |
| `README.md`   | The main README file for the project.                  |
| `CONTRIBUTING.md` | Guidelines for contributing to the project.         |
| `FAQ.md`      | Frequently asked questions and their answers.          |
| `LICENSE`     | The license file for the project.                      |

## Prerequisites

Before installing and running Gen AI Trivia, ensure that you have the following prerequisites:

- Node.js (version 14 or higher)

- NPM (version 6 or higher)

- Python / Pip (version 3.9 or higher)

- [AWS CloudFormation Development Kit (CDK)](https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html#getting_started_install)

- AWS account with necessary permissions

- [AWS CLI installed](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) and [configured](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-quickstart.html)

## Installation and Setup

Note: This solution can only be used in AWS Regions that have access to the Amazon Bedrock Claude 3 Sonnet model.

### Get access to Amazon Bedrock Claude 3 Sonnet Model

The Gen AI Trivia solution uses the Amazon Bedrock Claude 3 Sonnet model as the method to generate the topic questions.

1. Navigate to the Amazon Bedrock Service. 

   ![alt text](images/bedrock/bedrock_setup_1.png)

2. Click on "Get started".

   ![alt text](images/bedrock/bedrock_setup_2.png)

3. If this is your first time using Amazon Bedrock, you will receive a welcome message. From there, click on "Manage model access".

   ![alt text](images/bedrock/bedrock_setup_3.png)

4. Once on the Model access page, click on "Enable specific models".

   ![alt text](images/bedrock/bedrock_setup_4.png)

5. Scroll down to the "Anthropic" section and click on the box next to the "Claude 3 Sonnet" model. Scroll down to the bottom of the page and click "Next". 

   ![alt text](images/bedrock/bedrock_setup_5.png)

6. Review that you've selected the correct model and click "Submit".

   ![alt text](images/bedrock/bedrock_setup_6.png)

7. Once the model access request has been submitted, it should be approved. To verify it was approved, navigate back to the "Model access" page and ensure you see an "Access granted" text next to the requested model.

   ![alt text](images/bedrock/bedrock_setup_7.png)

### Deploy CI/CD Pipeline

The Gen AI Trivia code will deploy a CI/CD Pipeline that will deploy the Gen AI Trivia application. To install and set up the Gen AI Trivia Pipeline, follow these steps:

1. Clone the repository.

   ```bash
   git clone https://github.com/aws-samples/gen-ai-trivia.git
   ```

2. Navigate to the project directory.

   ```bash
   cd gen-ai-trivia
   ```

3. Install Python dependencies.

   ```bash
   pip install -r requirements.txt
   ```

4. Ensure you have access to an AWS Account.

5. Create initial CDK Bootstrap dependencies, then generate AWS CloudFormation Code and finally deploy the generated code.

   ```bash
   cdk bootstrap
   cdk synth gen-ai-trivia-pipeline
   cdk deploy gen-ai-trivia-pipeline --require-approval never
   ```

6. To trigger the run of the AWS CodePipeline, the code must be uploaded to the designated Source S3 Bucket. _Optionally, this step can be automated by leveraging GitHub Actions or equivalent version control and Continuous Integration (CI) technologies._

   ```bash
   python ./scripts/upload_to_source_bucket.py
   ```

   The pipeline run will create 3 AWS CloudFormation stacks (_gen-ai-trivia-pipeline_, _gen-ai-trivia-application_, and _gen-ai-trivia-s3-artifact-deployment_). Once the pipeline completes, continue to the next step. 

   ![alt text](images/cloudformation_stacks.png)

7. Add users to the Amazon Cognito User Pool.

   a. Navigate to the Amazon Cognito service.

   ![alt text](images/userpool/user_setup_1.png)

   b. Ensure you're in the "User pools" section and select the generated user pool.

   ![alt text](images/userpool/user_setup_2.png)

   c. Ensure you're in the "Users" section and click on "Create user".

   ![alt text](images/userpool/user_setup_3.png)

   d. Select "Send an email invitation", enter in the desired "User name", enter an email address you have access to, select "Mark email address as verified", and select "Generate a password". Doing the following will generate an email with a password for the first time you log in.  

   ![alt text](images/userpool/user_setup_4.png)

8. Once the deployment is complete, access the application using the provided URL. The URL can be found in the "Outputs" tab of the AWS CloudFormation stack "_gen-ai-trivia-application_". 

   ![alt text](images/cloudformation_stacks.png)

   Or run the following command to get the URL:

   ```bash
   aws cloudformation describe-stacks --stack-name "gen-ai-trivia-application" --query 'Stacks[*].Outputs[?OutputKey==`oTerraformBucket`].OutputValue' --output text
   ```

9. Navigate to and log in to the URL from step 7. Use the email with the generated password from step 5 to log in. Once you are logged in, you will be prompted to change the password.

   ![alt text](images/userpool/user_login.png)   ![alt text](images/userpool/pass_change.png)

10. Work hard. Have fun. Make history.

   ![alt text](images/frontend_1.png)

## Uninstall Solution

1. To remove the AWS CloudFormation Stacks along with the AWS Resources they create, run the following commands:

   ```bash
   cdk destroy gen-ai-trivia-s3-artifact-deployment --force
   aws cloudformation delete-stack --stack-name gen-ai-trivia-application
   aws cloudformation wait stack-delete-complete --stack-name gen-ai-trivia-application
   cdk destroy gen-ai-trivia-pipeline --force
   ```

## Contributing

We welcome contributions to improve the Gen AI Trivia project. Please refer to the [CONTRIBUTING.md](CONTRIBUTING.md) file for detailed guidelines on how to contribute.

## FAQ

For common issues and their resolutions, please refer to the [FAQ.md](FAQ.md) file. 

## License

This project is licensed under the [MIT License](LICENSE).
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import json
from constructs import Construct
from aws_cdk import (
    Stack,
    Tags,
    Aspects,
    CfnOutput
)
from cdk_nag import AwsSolutionsChecks
from app.dynamodb_helper import create_dynamodb
from app.cognito_helper import CognitoUserPool
from app.cloudfront_helper import CreateCloudFrontFrontEnd
from app.lambda_streaming import BedrockStreamingFunction


class ApplicationStack(Stack):
    """
    Application stack for Gen AI Trivia.

    This stack creates the core application infrastructure, including:
    - DynamoDB table
    - Cognito user pool and identity pool
    - CloudFront distribution for frontend hosting 
    - Lambda function for streaming question generation

    Attributes:
        table (dynamodb.ITable): The DynamoDB table.
        user_pool (CognitoUserPool): The Cognito user pool.
        frontend (CreateCloudFrontFrontEnd): The CloudFront distribution for frontend hosting.
        streaming_lambda (BedrockStreamingFunction): The Lambda function for streaming question generation.
    """

    def __init__(self, scope: Construct, construct_id: str, config: dict, **kwargs) -> None:
        """
        Initialize the ApplicationStack.

        Args:
            scope (Construct): The parent of this stack, usually an App or a Stage, but could be any construct.
            construct_id (str): The identifier of this stack. Must be unique within this scope.  
            config (dict): Application configuration.
            **kwargs: Other parameters passed to the base class.

        Attributes:
            Tags: Tags applied to all resources in the stack.
        """
        super().__init__(scope, construct_id, **kwargs)
        # DynamoDB Tables
        create_dynamodb(
            scope=self,
            table_name=config["appInfrastructure"]["dynamoDb"]["tableName"]
        )

        # Cognito
        cognito = CognitoUserPool(
            self,
            "rCreateCognitoUserPool",
            table_name=config["appInfrastructure"]['dynamoDb']['tableName']
        )

        cog_identity_pool_id = cognito.get_identity_pool_id()

        CfnOutput(
            self,
            "oGenAiTriviaCognitoPoolIdOutput", 
            value=cog_identity_pool_id,
            description="Cognito Identity Pool ID"
        )

        # CloudFront
        cloudfront = CreateCloudFrontFrontEnd(
            self,
            "rCreateCloudFrontFrontEnd"
        )

        cf_distribution_domain_name = cloudfront.get_distribution_domain_name()

        CfnOutput(
            self,
            "oGenAiTriviaCloudFrontDistributionDomainName",
            value=cf_distribution_domain_name,
            description="CloudFront Distribution Domain Name"
        )

        # BedRock
        BedrockStreamingFunction(
            self,
            "rBedrockStreamingFunction"
        )

        # Add tags to all resources created
        tags = json.loads(json.dumps(config["tags"]))
        for key, value in tags.items():
            Tags.of(self).add(key, value)

        Aspects.of(self).add(AwsSolutionsChecks())
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

from constructs import Construct
from aws_cdk import (
    aws_cloudfront as cloudfront,
    aws_cloudfront_origins as origins,
    Stack,
    RemovalPolicy,
    aws_s3 as s3,
    aws_iam as iam,
    aws_ssm as ssm
)
from cdk_nag import NagSuppressions


class CreateCloudFrontFrontEnd(Construct):
    """
    CloudFront distribution for frontend hosting.

    This class creates an S3 bucket for hosting the frontend, and a CloudFront
    distribution to serve the frontend content.

    Attributes:
        s3_bucket (s3.Bucket): The S3 bucket for hosting the frontend.
        s3_deployment (s3_deployment.BucketDeployment): Deploys the frontend files to the S3 bucket.
        origin_access_identity (cloudfront.OriginAccessIdentity): CloudFront origin access identity to access the S3 bucket.
        user_pool (cognito.UserPool): The Cognito user pool for user authentication.
        user_pool_client (cognito.UserPoolClient): The Cognito user pool client.
    """

    def __init__(self, scope: Construct, id: str, **kwargs):
        """
        Initialize the CreateCloudFrontFrontEnd construct.

        Args:
            scope (Construct): The scope of the construct.
            id (str): The ID of the construct.  
            **kwargs: Additional arguments.

        Attributes:
            bucket (s3.Bucket): The S3 bucket for hosting the frontend.
            distribution (cloudfront.Distribution): The CloudFront distribution for serving the frontend.
        """
        super().__init__(scope, id, **kwargs)

        # Get the stack name and region
        stack = Stack.of(scope)
        region = stack.region
        account = stack.account

        # Create an S3 bucket for hosting the frontend and CloudFront Logs
        self.app_bucket = s3.Bucket(
            self,
            "rGenAiTriviaFrontendS3Bucket",
            removal_policy=RemovalPolicy.DESTROY,
            auto_delete_objects=True,
            bucket_name=f"gen-ai-trivia-frontend-{region}-{account}",
            enforce_ssl=True
        )

        NagSuppressions.add_resource_suppressions(
            self.app_bucket,
            [
                {
                    "id": "AwsSolutions-S1",
                    "reason": "The S3 Bucket has server access logs disabled.",
                }
            ]
        )

        self.log_bucket = s3.Bucket(
            self,
            "rGenAiTriviaFrontendLogS3Bucket",
            removal_policy=RemovalPolicy.DESTROY,
            auto_delete_objects=True,
            bucket_name=f"gen-ai-trivia-frontend-logs-{region}-{account}",
            access_control=s3.BucketAccessControl.LOG_DELIVERY_WRITE,
            enforce_ssl=True
        )

        NagSuppressions.add_resource_suppressions(
            self.log_bucket,
            [
                {
                    "id": "AwsSolutions-S1",
                    "reason": "The S3 Bucket has server access logs disabled.",
                }
            ]
        )

        # Create an Origin Access Identity (OAI) for CloudFront
        self.oai = cloudfront.OriginAccessIdentity(self, "rGenAiTriviaOai")

        # Grant the OAI access to the S3 bucket
        self.app_bucket.add_to_resource_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                principals=[self.oai.grant_principal],
                actions=["s3:GetObject"],
                resources=[f"arn:aws:s3:::{self.app_bucket.bucket_name}/*"]
            )
        )

        # Create a CloudFront Web Distribution
        self.distribution = cloudfront.Distribution(
            self,
            "rGenAiTriviaCloudFrontDistribution",
            default_root_object="index.html",
            default_behavior=cloudfront.BehaviorOptions(
                origin=origins.S3Origin(self.app_bucket, origin_access_identity=self.oai),
            ),
            enabled=True,
            error_responses=[
                cloudfront.ErrorResponse(
                    http_status=404,
                    response_http_status=404,
                    response_page_path="/error.html",
                )
            ],
            enable_logging=True,
            log_bucket=self.log_bucket,
            log_file_prefix="gen-ai-trivia-frontend-cloudfront-logs"
        )

        NagSuppressions.add_resource_suppressions(
            self.distribution,
            [
                {
                    "id": "AwsSolutions-CFR1",
                    "reason": "The CloudFront distribution may require Geo restrictions.",
                },
                {
                    "id": "AwsSolutions-CFR2",
                    "reason": "The CloudFront distribution may require integration with AWS WAF.",
                },
                {
                    "id": "AwsSolutions-CFR4",
                    "reason": "The CloudFront distribution allows for SSLv3 or TLSv1 for HTTPS viewer connections.",
                },
                {
                    "id": "AwsSolutions-CFR7",
                    "reason": "The CloudFront distribution does not use an origin access control with an S3 origin."
                },
                {
                    "id": "AwsSolutions-S1",
                    "reason": "The S3 Bucket has server access logs disabled.",
                },
                {
                    "id": "AwsSolutions-S10",
                    "reason": "The S3 Bucket or bucket policy does not require requests to use SSL.",
                }
            ],
            apply_to_children=True
        )

        ssm.StringParameter(
            self,
            "rGenAiTriviaS3BucketName",
            parameter_name="/genAiTrivia/s3/bucketArn",
            string_value=self.app_bucket.bucket_arn
        )
        ssm.StringParameter(
            self,
            "rGenAiTriviaCloudfrontDistributionId",
            parameter_name="/genAiTrivia/cloudfront/distributionId",
            string_value=self.distribution.distribution_id
        )
        ssm.StringParameter(
            self,
            "rGenAiTriviaCloudfrontDistributionDomainName",
            parameter_name="/genAiTrivia/cloudfront/distributionDomainName",
            string_value=self.distribution.domain_name
        )

    def get_distribution_domain_name(self):
        """
        Get the CloudFront distribution domain name.

        Returns:
            str: The CloudFront distribution domain name.
        """
        return self.distribution.distribution_domain_name
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

from constructs import Construct
from aws_cdk import (
    RemovalPolicy,
    Stack,
    Duration,
    aws_iam as iam,
    aws_cognito as cognito,
    aws_cognito_identitypool_alpha as cognitoip,
    aws_ssm as ssm
)
from cdk_nag import NagSuppressions


class CognitoUserPool(Construct):
    """
    Cognito user pool and identity pool for user authentication and authorization.

    This class creates a Cognito user pool, user pool client, and identity pool,
    along with the necessary IAM roles and policies. It also stores the relevant
    IDs in Systems Manager Parameter Store.

    Attributes:
        user_pool (cognito.UserPool): The Cognito user pool.
        user_pool_client (cognito.UserPoolClient): The Cognito user pool client.
        identity_pool (cognitoip.IdentityPool): The Cognito identity pool.
    """

    def __init__(self, scope: Construct, id: str, table_name: str, **kwargs):
        """
        Initialize the CognitoUserPool construct.

        Args:  
            scope (Construct): The scope of the construct.
            id (str): The ID of the construct.
            table_name (str): The name of the DynamoDB table.
            **kwargs: Additional arguments.
        """
        super().__init__(scope, id, **kwargs)

        # Get the stack name and region
        stack = Stack.of(self)
        region = stack.region
        account = stack.account
        partition = stack.partition

        # Cognito User Pool
        self.user_pool = cognito.UserPool(
            self,
            "rGenAiTriviaCognitoUserPool",
            removal_policy=RemovalPolicy.DESTROY,
            self_sign_up_enabled=False,
            user_pool_name="GenAI-Trivia-UserPool",
            password_policy=cognito.PasswordPolicy(
                min_length=8,
                require_lowercase=True,
                require_uppercase=True,
                require_digits=True,
                require_symbols=True,
                temp_password_validity=Duration.days(3)
            ),
            advanced_security_mode=cognito.AdvancedSecurityMode.ENFORCED
        )

        NagSuppressions.add_resource_suppressions(
            self.user_pool,
            [
                {
                    "id": "AwsSolutions-COG2",
                    "reason": "The Cognito user pool does not require MFA."
                }
            ]
        )

        user_pool_client = self.user_pool.add_client(
            "rGenAiTriviaCognitoUserPoolClient",
            user_pool_client_name="GenAI-Trivia-UserPoolClient",
            # id_token_validity=Duration.days(1),
            # access_token_validity=Duration.days(1),
            generate_secret=False
        )

        # Cognito Identity Pool
        self.identity_pool = cognitoip.IdentityPool(
            self,
            "rGenAiTriviaCognitoIdentityPool",
            identity_pool_name="GenAI-Trivia",
            allow_unauthenticated_identities=False,
            authentication_providers=cognitoip.IdentityPoolAuthenticationProviders(
                user_pools=[
                    cognitoip.UserPoolAuthenticationProvider(
                        user_pool=self.user_pool,
                        user_pool_client=user_pool_client
                    )
                ]
            )
        )

        self.identity_pool.authenticated_role.add_to_principal_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "dynamodb:PutItem",
                    "dynamodb:Scan",
                    "dynamodb:Query",
                    "dynamodb:UpdateItem",
                    "dynamodb:UpdateTable",
                    "dynamodb:GetRecords"
                ],
                resources=[
                    f"arn:{partition}:dynamodb:{region}:{account}:table/{table_name}/index/*",
                    f"arn:{partition}:dynamodb:{region}:{account}:table/{table_name}/stream/*",
                    f"arn:{partition}:dynamodb:{region}:{account}:table/{table_name}"
                ]
            )
        )

        self.identity_pool.authenticated_role.add_to_principal_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "lambda:InvokeFunction",
                    "lambda:InvokeAsync"
                ],
                resources=[
                    f"arn:{partition}:lambda:{region}:{account}:function:bedrock-generate-questions-streaming"
                ]
            )
        )

        self.identity_pool.authenticated_role.add_to_principal_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=["cognito-identity:GetCredentialsForIdentity"],
                resources=["*"]
            )
        )

        NagSuppressions.add_resource_suppressions(
            self.identity_pool,
            [
                {
                    "id": "AwsSolutions-IAM5",
                    "reason": "The IAM entity contains wildcard permissions and does not have " \
                        "a cdk-nag rule suppression with evidence for those permission.",
                }
            ],
            apply_to_children=True
        )

        ssm.StringParameter(
            self,
            "rGenAiTriviaCognitoUserPoolId",
            parameter_name="/genAiTrivia/cognito/userPoolId",
            string_value=self.user_pool.user_pool_id,
        )
        ssm.StringParameter(
            self,
            "rGenAiTriviaCognitoUserPoolClientId",
            parameter_name="/genAiTrivia/cognito/userPoolClientId",
            string_value=user_pool_client.user_pool_client_id,
        )
        ssm.StringParameter(
            self,
            "rGenAiTriviaCognitoIdentityPoolId",
            parameter_name="/genAiTrivia/cognito/identityPoolId",
            string_value=self.identity_pool.identity_pool_id,
        )

    def get_identity_pool_id(self):
        """
        Get the Cognito identity pool ID.

        Returns:
            str: The Cognito identity pool ID.
        """
        return self.identity_pool.identity_pool_id
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

from aws_cdk import aws_dynamodb as dynamodb, RemovalPolicy


def create_dynamodb(
    scope, table_name: str, pit_recovery: bool = True
) -> dynamodb.ITable:
    """
    Create a DynamoDB table.

    Args:
        scope (Construct): The scope in which to define this construct.
        table_name (str): Desired DynamoDB Table name.
        pit_recovery (bool, optional): Enable Point in Time Recovery. Defaults to True.

    Returns:
        dynamodb.ITable: CDK Interface for created DynamoDB Table
    """

    table = dynamodb.Table(
        scope,
        f"rGenAiTriviaDynamoDBTable{table_name.title().replace('/','')}",
        table_name=table_name,
        partition_key=dynamodb.Attribute(name="id", type=dynamodb.AttributeType.STRING),
        sort_key=dynamodb.Attribute(name="score", type=dynamodb.AttributeType.NUMBER),
        point_in_time_recovery=pit_recovery,
        removal_policy=RemovalPolicy.DESTROY,
    )

    table.add_global_secondary_index(
        index_name="sortedScores",
        partition_key=dynamodb.Attribute(
            name="sortID", type=dynamodb.AttributeType.NUMBER
        ),
        sort_key=dynamodb.Attribute(name="score", type=dynamodb.AttributeType.NUMBER),
    )

    return table
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import aws_cdk as cdk
from constructs import Construct
from aws_cdk import (
    aws_lambda as _lambda,
    aws_iam as iam
)
from cdk_nag import NagSuppressions


class BedrockStreamingFunction(Construct):
    """
    Lambda function for streaming question generation using Bedrock.

    This class creates a Lambda function with the necessary permissions and
    configuration to generate questions using the Bedrock AI model.

    Attributes:
        function (lambda.Function): The Lambda function.
    """

    def __init__(self, scope: Construct, id: str, **kwargs):
        """
        Initialize the BedrockStreamingFunction construct.

        Args:
            scope (Construct): The scope of the construct.  
            id (str): The ID of the construct.
            **kwargs: Additional arguments.
        """
        super().__init__(scope, id, **kwargs)

        self.lambda_function = _lambda.Function(
            self,
            "rGenAiTriviaBedrockStreamingFunction",
            function_name="bedrock-generate-questions-streaming",
            runtime=_lambda.Runtime.NODEJS_20_X,
            handler="index.handler",
            code=_lambda.Code.from_asset("app/lambda_src/generate_questions_streaming"),
            timeout=cdk.Duration.seconds(900)
        )

        self.lambda_function.add_to_role_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=["bedrock:InvokeModelWithResponseStream"],
                resources=["*"]
            )
        )

        NagSuppressions.add_resource_suppressions(
            self.lambda_function,
            [
                {
                    "id": "AwsSolutions-IAM4",
                    "reason": "Managed policy for Lambda Execution",
                },
                {
                    "id": "AwsSolutions-IAM5",
                    "reason": "Using wildcard to allow multiple models if needed.",
                }
            ],
            apply_to_children=True
        )
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

from constructs import Construct
from aws_cdk import (
    Stack,
    Aspects,
    aws_s3 as s3,
    aws_cloudfront as cloudfront,
    aws_ssm as ssm,
    aws_s3_deployment as s3deploy
)
from cdk_nag import NagSuppressions, AwsSolutionsChecks


class S3ArtifactDeployment(Stack):
    """
    A CDK Stack that deploys an artifact to an S3 bucket and associates it with a CloudFront distribution.

    Deploys the frontend artifact to the S3 bucket created in the main application stack.
    """

    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        """
        Initializes the S3ArtifactDeployment stack.

        Args:
            scope (Construct): The scope in which this construct is created.
            construct_id (str): The unique identifier for this construct.
            **kwargs: Additional keyword arguments to pass to the Stack constructor.
        """
        super().__init__(scope, construct_id, **kwargs)

        ssm_bucket_arn = self.get_ssm_value(parameter_name="/genAiTrivia/s3/bucketArn")
        ssm_distribution_id = self.get_ssm_value(parameter_name="/genAiTrivia/cloudfront/distributionId")
        ssm_distribution_name = self.get_ssm_value(parameter_name="/genAiTrivia/cloudfront/distributionDomainName")

        i_bucket = s3.Bucket.from_bucket_attributes(
            self,
            "rGetIBucket",
            bucket_arn=ssm_bucket_arn
        )

        i_distribution = cloudfront.Distribution.from_distribution_attributes(
            self,
            "rGetIDistribution",
            distribution_id=ssm_distribution_id,
            domain_name=ssm_distribution_name
        )

        s3deploy.BucketDeployment(
            self,
            "rGenAiTriviaDeploySourceToBucket",
            sources=[s3deploy.Source.asset("./www/dist")],
            destination_bucket=i_bucket,
            distribution=i_distribution,
            distribution_paths=["/*"]
        )

        NagSuppressions.add_resource_suppressions(
            self,
            [
                {
                    "id": "AwsSolutions-IAM4",
                    "reason": "The IAM user, role, or group uses AWS managed policies."
                },
                {
                    "id": "AwsSolutions-IAM5",
                    "reason": "The IAM entity contains wildcard permissions and does not have " \
                        "a cdk-nag rule suppression with evidence for those permission."
                },
                {
                    "id": "AwsSolutions-L1",
                    "reason": "The non-container Lambda function is not configured to use the latest runtime version."
                }
            ],
            apply_to_children=True
        )

        Aspects.of(self).add(AwsSolutionsChecks())

    def get_ssm_value(self, parameter_name: str):
        """Retrieves the value of a Systems Manager parameter.

        Args:
            scope (cdk.Construct): The construct scope.
            parameter_name (str): The name of the SSM parameter.

        Returns:
            str: The value of the SSM parameter.

        This function retrieves the value of an SSM parameter by name. It first uses
        the CDK's value_from_lookup method to get the parameter value. If the value
        contains the string 'dummy-value', it will return either a hardcoded ARN
        or the string 'dummy-value' itself. Otherwise it simply returns the
        original value retrieved from SSM.
        """
        _value = ssm.StringParameter.value_from_lookup(self, parameter_name)
        if 'dummy-value' in _value and "arn" in _value.lower():
            return "arn:aws:service:us-east-1:123456789012:entity/dummy-value"
        if 'dummy-value' in _value:
            return "dummy-value"

        return _value
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

# !/usr/bin/env python3

import yaml
import os
import aws_cdk as cdk
from pipeline.pipeline_stack import PipelineStack
from app.s3_artifact_deployment import S3ArtifactDeployment

# Get data from config file and convert to dict
config_file_path = "./configs/deploy-config.yaml"
with open(config_file_path, "r", encoding="utf-8") as f:
    config = yaml.load(f, Loader=yaml.SafeLoader)

app = cdk.App()

# Pipeline Stack
PipelineStack(
    app,
    config["deployInfrastructure"]["cloudformation"]["stackName"],
    env=cdk.Environment(
        account=os.getenv("CDK_DEFAULT_ACCOUNT"), region=os.getenv("CDK_DEFAULT_REGION")
    ),
    config=config,
)

S3ArtifactDeployment(
    app,
    config["appInfrastructure"]["productName"] + "-s3-artifact-deployment",
    env=cdk.Environment(
        account=os.getenv("CDK_DEFAULT_ACCOUNT"), region=os.getenv("CDK_DEFAULT_REGION")
    )
)

app.synth()
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

from constructs import Construct
from aws_cdk import Stage
from app.app_stack import ApplicationStack


class PipelineAppStage(Stage):
    """
    Application stage for the CDK pipeline.

    This class represents a stage in the CDK pipeline that deploys the
    application stack.

    Attributes:
        app_stack (ApplicationStack): The application stack instance.
    """

    def __init__(self, scope: Construct, construct_id: str, config: dict, **kwargs) -> None:
        """
        Initialize the PipelineAppStage.
        
        Args:
            scope (Construct): The parent of this stage, usually an App or a Stage, but could be any construct.
            construct_id (str): The identifier of this stage. Must be unique within this scope.
            config (dict): Application configuration.  
            **kwargs: Other parameters passed to the base class.
        """
        super().__init__(scope, construct_id, **kwargs)

        ApplicationStack(
            self, config['appInfrastructure']['productName'],
            stack_name=config['appInfrastructure']['cloudformation']['stackName'],
            config=config
        )
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import json
import os
import tempfile
import shutil
import fileinput
from pathlib import Path
from aws_cdk import SecretValue, aws_ssm as ssm


def get_secret_value(secrets_name: str):
    """Retrieves the value of a secret from AWS Secrets Manager.

    Args:
        secrets_name (str): The name of the secret. Can be the secret ID
            or a JSON field in the format "secret_id.json_field".

    Returns:
        str: The value of the secret.

    This function retrieves secrets stored in AWS Secrets Manager. It handles
    both cases where secrets_name is just the secret ID, and where it contains
    the secret ID and JSON field separated by a period. The secret value is
    returned after retrieving it from Secrets Manager.
    """
    if len(secrets_name.split(".")) == 1:
        _value = SecretValue.secrets_manager(secret_id=secrets_name).to_string()

    if len(secrets_name.split(".")) > 1:
        _secrets_id = secrets_name.split(".")[0]
        _secret_json = secrets_name.split(".")[1]
        _value = SecretValue.secrets_manager(
            secret_id=_secrets_id, json_field=_secret_json
        ).to_string()

    return _value


def get_ssm_value(scope, parameter_name: str):
    """Retrieves the value of a Systems Manager parameter.

    Args:
        scope (cdk.Construct): The construct scope.
        parameter_name (str): The name of the SSM parameter.

    Returns:
        str: The value of the SSM parameter.

    This function retrieves the value of an SSM parameter by name. It first uses
    the CDK's value_from_lookup method to get the parameter value. If the value
    contains the string 'dummy-value', it will return either a hardcoded ARN
    or the string 'dummy-value' itself. Otherwise it simply returns the
    original value retrieved from SSM.
    """
    _value = ssm.StringParameter.value_from_lookup(scope, parameter_name)
    if "dummy-value" in _value and "arn" in _value.lower():
        return "arn:aws:service:us-east-1:123456789012:entity/dummy-value"
    if "dummy-value" in _value:
        return "dummy-value"

    return _value


def replace_ssm_in_config(scope, temp_config: dict) -> dict:
    """Replaces SSM and secret values in a configuration dictionary.

    Args:
        scope (cdk.Construct): The construct scope.
        temp_config (dict): The configuration dictionary.

    Returns:
        dict: The updated configuration dictionary with SSM and secret values replaced.

    This function recursively searches the configuration dictionary for strings
    containing "SSM:" or "SECRET:". These values are replaced by calling
    get_ssm_value() or get_secret_value() respectively. The configuration is
    searched at all dictionary levels to support nested structures. The updated
    configuration is returned.
    """
    for key1, val1 in temp_config.items():
        if isinstance(val1, str) and "SSM:" in val1:
            temp_config[key1] = get_ssm_value(
                scope, parameter_name=val1.replace("SSM:", "")
            )

        if isinstance(val1, str) and "SECRET:" in val1:
            temp_config[key1] = get_secret_value(
                secrets_name=val1.replace("SECRET:", "")
            )

        if isinstance(val1, dict):
            for key2, val2 in val1.items():
                if isinstance(val2, str) and "SSM:" in val2:
                    temp_config[key1][key2] = get_ssm_value(
                        scope, parameter_name=val2.replace("SSM:", "")
                    )

                if isinstance(val2, str) and "SECRET:" in val2:
                    temp_config[key1][key2] = get_secret_value(
                        secrets_name=val2.replace("SECRET:", "")
                    )

                if isinstance(val2, dict):
                    for key3, val3 in val2.items():
                        if isinstance(val3, str) and "SSM:" in val3:
                            temp_config[key1][key2][key3] = get_ssm_value(
                                scope, parameter_name=val3.replace("SSM:", "")
                            )

                        if isinstance(val3, str) and "SECRET:" in val3:
                            temp_config[key1][key2][key3] = get_secret_value(
                                secrets_name=val3.replace("SECRET:", "")
                            )

        if isinstance(val1, list):
            count = 0
            for _val1 in val1:
                for key2, val2 in _val1.items():
                    if isinstance(val2, str) and "SSM:" in val2:
                        temp_config[key1][count][key2] = get_ssm_value(
                            scope, parameter_name=val2.replace("SSM:", "")
                        )

                    if isinstance(val2, str) and "SECRET:" in val2:
                        temp_config[key1][count][key2] = get_secret_value(
                            secrets_name=val1.replace("SECRET:", "")
                        )

                count = count + 1

    return temp_config


def update_config(existing_config: dict, account_info) -> dict:
    """Updates an existing configuration dictionary with account info.

    Args:
        existing_config (dict): The existing configuration dictionary.
        account_info (str): A JSON string containing account info.

    Returns:
        dict: The updated configuration dictionary.

    This function takes an existing configuration dictionary and account
    information as a JSON string. It loads the account info JSON and iterates
    through the key-value pairs. If the key is "deploy", it updates the
    "deploymentAccount" in the config. Otherwise it finds the matching SDLC
    account by name and updates its "awsAccount". The updated configuration
    is returned.
    """
    acc_info = json.loads(account_info)
    for key, value in acc_info.items():
        if key.lower() == "deploy":
            existing_config["deploymentAccount"].update({"awsAccount": value})
        else:
            for sdlc_acc in existing_config["sdlcAccounts"]:
                if sdlc_acc["name"] == key:
                    sdlc_acc.update({"awsAccount": value})

    return existing_config


def create_archive(config: dict = {}, zip_name="zip_file") -> str:
    """Creates a zip archive of files from a configuration.

    Args:
        config (dict, optional): Configuration dictionary. Defaults to empty dict.
        zip_name (str, optional): Name of the zip file. Defaults to 'zip_file'.

    Returns:
        str: Path to the created zip file.

    This function creates a temporary directory and copies files from the
    project root directory into it, ignoring any files/directories specified
    in the 'codecommit' configuration. It then searches for and replaces any
    strings specified in the 'fileReplacement' config. Finally, it zips the
    contents of the temporary directory and returns the path to the created
    zip archive.
    """
    # Setting up array with a None value
    ignored_files_directories = config["deployInfrastructure"]["codecommit"].get(
        "ignoreFilesDirectoriesCodeCommit", []
    )

    # Adding standard ignored files/directories to variable
    ignored_files_directories.extend(
        (
            "__pycache__",
            "cdk.out",
            ".git",
            ".DS_Store",
            ".venv",
            ".python-version",
            "dist",
            "node_modules",
        )
    )

    root_dir = Path(__file__).parents[1]
    with tempfile.TemporaryDirectory() as tmpdir:
        # Create a copy of the directory
        shutil.copytree(
            root_dir,
            os.path.join(tmpdir, zip_name),
            # UPDATE this section if there are additional pattern that need to be ignored
            ignore=shutil.ignore_patterns(*ignored_files_directories),
        )

        for item in config["deployInfrastructure"]["codecommit"].get(
            "fileReplacement", []
        ):
            file_string_replacement(
                filename=f"{os.path.join(tmpdir, zip_name)}/{item['filename']}",
                search_str=item["search_str"],
                replace_str=item["replace_str"],
            )

        # Create Zip File
        shutil.make_archive(
            os.path.join("cdk.out/", zip_name), "zip", os.path.join(tmpdir, zip_name)
        )

    return os.path.join("cdk.out/", zip_name + ".zip")


def file_string_replacement(filename: str, search_str: str, replace_str: str) -> None:
    """
    Replace a string in a file.

    Args:
        filename (str): The path to the file to modify.
        search_str (str): The string to search for.
        replace_str (str): The string to replace matches with.

    Returns:
        None
    
    This function replaces all occurrences of search_str with replace_str
    in the given filename. It uses fileinput.FileInput to open the file
    in-place, iterates through each line, and prints it after replacing
    the search string. This has the effect of modifying the file contents
    directly.
    """
    with fileinput.FileInput(filename, inplace=True, backup="") as file:
        for line in file:
            print(line.replace(search_str, replace_str), end="")
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import os
import json
from constructs import Construct
from aws_cdk import (
    Stack,
    Aws,
    Aspects,
    Environment,
    Tags,
    RemovalPolicy,
    pipelines,
    aws_iam as iam,
    aws_s3 as s3,
    aws_codepipeline_actions as codepipeline_actions
)
from cdk_nag import NagSuppressions, AwsSolutionsChecks
from pipeline.pipeline_app_stage import PipelineAppStage


class PipelineStack(Stack):
    """
    CDK Stack for the deployment pipeline.

    This stack sets up the CodePipeline for building and deploying the application.
    It includes the source, build, and deployment stages, along with necessary resources
    such as S3 buckets and IAM roles.
    """

    def create_pipeline_source_bucket(self, config: dict):
        """
        Creates an S3 bucket for uploading the source code archive.

        Args:
            config (dict): The application configuration.
            
        Returns:
            s3.Bucket: The created S3 bucket.
        """
        # Get current stack name
        stack = Stack.of(self)
        region = stack.region
        account = stack.account

        # Create CodePipeline Source Bucket
        src_bucket_name = f"{config['deployInfrastructure']['codepipeline']['sourceBucketPrefix']}-{region}-{account}"
        self.source_bucket = s3.Bucket(
            self,
            "rGenAiTriviaSourceS3Bucket",
            removal_policy=RemovalPolicy.DESTROY,
            auto_delete_objects=True,
            bucket_name=src_bucket_name,
            enforce_ssl=True,
            versioned=True
        )
        self.source_bucket_arn = self.source_bucket.bucket_arn

        NagSuppressions.add_resource_suppressions(
            self.source_bucket,
            [
                {
                    "id": "AwsSolutions-S1",
                    "reason": "The S3 Bucket has server access logs disabled."
                }
            ]
        )

        return self.source_bucket

    def create_pipeline(self, config: dict):
        """
        Creates the CodePipeline for building and deploying the application.

        Args:
            config (dict): The application configuration.
            
        The pipeline includes the source, build, and deployment stages, along with 
        necessary resources such as S3 buckets and IAM roles.
        """
        # Get current stack name
        stack_name = Aws.STACK_NAME
        stack = Stack.of(self)
        region = stack.region
        account = stack.account

        # Create an S3 bucket CodePipeline Artifacts
        self.pipeline_bucket = s3.Bucket(
            self,
            "rGenAiTriviaPipelineS3Bucket",
            removal_policy=RemovalPolicy.DESTROY,
            auto_delete_objects=True,
            bucket_name=f"gen-ai-trivia-pipeline-{region}-{account}",
            enforce_ssl=True
        )

        NagSuppressions.add_resource_suppressions(
            self.pipeline_bucket,
            [
                {
                    "id": "AwsSolutions-S1",
                    "reason": "The S3 Bucket has server access logs disabled."
                }
            ]
        )

        # Create a Pipeline
        source = pipelines.CodePipelineSource.s3(
            bucket=self.source_bucket,
            object_key="zipped/source.zip",
            action_name="Source",
            trigger=codepipeline_actions.S3Trigger.EVENTS
        )
        pipeline_name = config["deployInfrastructure"]["codepipeline"]["pipelineName"]
        deployment_pipeline = pipelines.CodePipeline(
            self,
            "rCodePipeline",
            pipeline_name=pipeline_name,
            artifact_bucket=self.pipeline_bucket,
            docker_enabled_for_self_mutation=True,
            docker_enabled_for_synth=True,
            enable_key_rotation=True,
            cross_account_keys=True,
            code_build_defaults=pipelines.CodeBuildOptions(
                role_policy=[
                    iam.PolicyStatement(
                        actions=[
                            "cloudformation:ListStacks", 
                            "ssm:GetParameter"
                        ],
                        resources=["*"],
                        effect=iam.Effect.ALLOW
                    )
                ],
                build_environment={"privileged": True}
            ),
            synth=pipelines.ShellStep(
                "Synth",
                input=source,
                commands=[
                    "cd www && npm ci && npm run build && cd ..",
                    "npm install -g aws-cdk",
                    "python -m pip install -r requirements.txt",
                    f'cdk synth {stack_name}'
                ]
            )
        )

        # Deployment Stage
        deployment_pipeline.add_stage(
            PipelineAppStage(
                self,
                "Deployment-Infrastructure",
                env=Environment(
                    account=os.getenv("CDK_DEFAULT_ACCOUNT"),
                    region=os.getenv("CDK_DEFAULT_REGION")
                ),
                config=config
            ),
            # Have to do this as a post step because cognito ids are synthed tokens in the asset otherwise
            post=[
                pipelines.CodeBuildStep(
                    "Deploy-WebApp",
                    input=source,
                    commands=[
                        "python scripts/update_amplify_config.py",
                        "cat www/src/amplifyconfiguration.json",
                        "cd www && npm ci && npm run build && cd ..",
                        "npm install -g aws-cdk",
                        "python -m pip install -r requirements.txt",
                        f'cdk synth {config["appInfrastructure"]["productName"]}-s3-artifact-deployment',
                        f'cdk deploy {config["appInfrastructure"]["productName"]}-s3-artifact-deployment --require-approval never'
                    ],
                    role_policy_statements=[
                        iam.PolicyStatement(
                            actions=["sts:AssumeRole"],
                            resources=[f"arn:aws:iam::{Aws.ACCOUNT_ID}:role/cdk-*"],
                            effect=iam.Effect.ALLOW
                        )
                    ]
                )
            ]
        )

        # Builds CodePipeline to allow for Suppression
        deployment_pipeline.build_pipeline()

        # Cleanup CodePipeline Artifact Bucket during Cfn Stack Deletion
        pipeline_bucket = deployment_pipeline.pipeline.artifact_bucket
        pipeline_bucket.apply_removal_policy(RemovalPolicy.DESTROY)

        NagSuppressions.add_resource_suppressions(
            deployment_pipeline,
            [
                {
                    "id": "AwsSolutions-S1",
                    "reason": "The S3 Bucket has server access logs disabled."
                },
                {
                    "id": "AwsSolutions-IAM5",
                    "reason": "The IAM entity contains wildcard permissions and does not " \
                        "have a cdk-nag rule suppression with evidence for those permission."
                },
                {
                    "id": "AwsSolutions-CB3",
                    "reason": "The CodeBuild project has privileged mode enabled."
                },
                {
                    "id": "AwsSolutions-CB4",
                    "reason": "The CodeBuild project does not use an AWS KMS key for encryption."
                }
            ],
            apply_to_children=True
        )

    def __init__(self, scope: Construct, construct_id: str, config: dict, **kwargs) -> None:
        """
        Initialize the PipelineStack.

        Args:
            scope (Construct): The parent of this stack, usually an App or a Stage, but could be any construct.
            construct_id (str): The identifier of this stack. Must be unique within this scope.
            config (dict): Application configuration.
            **kwargs: Other parameters passed to the base class.
        """
        super().__init__(scope, construct_id, **kwargs)

        # Create Source S3 Bucket
        self.create_pipeline_source_bucket(config=config)

        # CodePipeline Setup
        self.create_pipeline(config=config)

        # Add tags to all resources created
        tags = json.loads(json.dumps(config["tags"]))
        for key, value in tags.items():
            Tags.of(self).add(key, value)

        Aspects.of(self).add(AwsSolutionsChecks())
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import json
import boto3


def get_cognito_param_values() -> list[str]:
    """
    Retrieve the values of the Cognito user pool ID, user pool client ID,
    and identity pool ID from AWS Systems Manager Parameter Store.

    Returns:
        list[str]: A list containing the user pool ID, user pool client ID, and identity pool ID.
    """
    client = boto3.client("ssm")
    user_pool_id = client.get_parameter(Name="/genAiTrivia/cognito/userPoolId")["Parameter"]["Value"]
    user_pool_client_id = client.get_parameter(Name="/genAiTrivia/cognito/userPoolClientId")["Parameter"]["Value"]
    identity_pool_id = client.get_parameter(Name="/genAiTrivia/cognito/identityPoolId")["Parameter"]["Value"]
    return user_pool_id, user_pool_client_id, identity_pool_id


def main() -> None:
    """
    Write the Cognito user pool ID, user pool client ID, and
    identity pool ID to the Amplify configuration file.

    Returns:
        None
    """
    with open(
        "www/src/amplifyconfiguration.json", "w+", encoding="UTF-8"
    ) as amp_config:
        user_pool_id, user_pool_client_id, identity_pool_id = get_cognito_param_values()
        data = {
            "Auth": {
                "Cognito": {
                    "userPoolId": user_pool_id,
                    "userPoolClientId": user_pool_client_id,
                    "identityPoolId": identity_pool_id,
                }
            }
        }
        json.dump(data, amp_config)


if __name__ == "__main__":
    main()
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import os
import tempfile
import logging
import shutil
from pathlib import Path
import yaml
import boto3

logger = logging.getLogger()
logging.basicConfig(level=logging.INFO)
logger.setLevel(logging.INFO)
logger.info("Starting...")


def create_archive(config: dict, zip_name="source") -> str:
    """
    Create an archive of the source code, excluding specified files and directories.

    Args:
        config (dict): Application configuration.
        zip_name (str): The name of the zip archive (default: "source").

    Returns:
        str: The full path of the created archive file.

    The function creates a temporary directory, copies the source code into it
    (excluding specified files and directories), creates a zip archive of the
    temporary directory, and returns the full path of the created archive file.
    """
    logger.info("Creating archive")
    # Setting up array with a None value
    ignored_files_directories = config["deployInfrastructure"]['sourceCode'].get(
        "ignoreFilesDirectories", []
    )

    # Adding standard ignored files/directories to variable
    ignored_files_directories.extend(
        (
            "__pycache__",
            "cdk.out",
            ".git",
            ".DS_Store",
            ".venv",
            ".python-version",
            "dist",
            "node_modules",
        )
    )
    logger.info("Ignoring the following in archive file %s", ignored_files_directories)

    root_dir = Path(__file__).parents[1]
    with tempfile.TemporaryDirectory() as tmpdir:
        # Create a copy of the directory
        shutil.copytree(
            root_dir,
            os.path.join(tmpdir, zip_name),
            ignore=shutil.ignore_patterns(*ignored_files_directories),
        )
        # Create Zip File
        shutil.make_archive(
            os.path.join(zip_name), "zip", os.path.join(tmpdir, zip_name)
        )

    arch_file_path = os.path.join(tmpdir, zip_name + ".zip")
    logger.info("Archive Path: %s", arch_file_path)
    return arch_file_path


def get_pipeline_s3_bucket_name(src_bucket_prefix: str, client: object) -> str:
    """
    Retrieve the name of an S3 bucket that matches a given prefix.

    Args:
        src_bucket_prefix (str): The prefix to search for in bucket names.
            This is typically a string that partially matches the desired bucket name.
        client (object): An initialized boto3 S3 client object used to interact
            with the AWS S3 service. This client should have the necessary
            permissions to list buckets.

    Returns:
        str: The name of the first S3 bucket found that contains the specified prefix.
            If no matching bucket is found, the function implicitly returns None.
    """
    paginator = client.get_paginator('list_buckets')
    for buckets in paginator.paginate():
        for bucket in buckets['Buckets']:
            if src_bucket_prefix in bucket['Name']:
                return bucket['Name']


def execute_codepipeline(pipeline_name: str, client: object) -> None:
    """
    Start the execution of a CodePipeline.

    Args:
        cli (object): An initialized boto3 CodePipeline client object used to
            interact with the AWS CodePipeline service. This client should have
            the necessary permissions to start a pipeline execution.

    Returns:
        None
    """
    logger.info("Executing Pipeline: %s", pipeline_name)
    exec_response = client.start_pipeline_execution(
        name=pipeline_name
    )
    logger.info("Pipeline Execution Id: %s", exec_response['pipelineExecutionId'])


if __name__ == "__main__":
    # Main function to upload the source code archive to the pipeline source S3 bucket.

    # The function reads the application configuration, creates a source code archive using
    # create_archive(), and uploads the archive to the specified S3 bucket.

    # It handles any exceptions and logs appropriate messages.

    # The function reads the application configuration, creates a source code archive using
    # create_archive(), and uploads the archive to the specified S3 bucket.

    # It handles any exceptions and logs appropriate messages.
    S3_CLIENT = boto3.client("s3")
    CP_CLIENT = boto3.client("codepipeline")

    try:
        CONFIG_FILE_PATH = "./configs/deploy-config.yaml"
        with open(CONFIG_FILE_PATH, "r", encoding="utf-8") as f:
            deploy_config = yaml.load(f, Loader=yaml.SafeLoader)

        SRC_BUCKET_PREFIX = deploy_config['deployInfrastructure']['codepipeline']['sourceBucketPrefix']
        CODEPIPELINE_NAME = deploy_config['deployInfrastructure']['codepipeline']['pipelineName']

        archive_file_path = create_archive(config=deploy_config)
        archive_file_name = archive_file_path.split("/")[-1]

        pipeline_bucket_name = get_pipeline_s3_bucket_name(
            src_bucket_prefix=SRC_BUCKET_PREFIX,
            client=S3_CLIENT
        )

        logger.info("Uploading %s to %s", "zipped/"+archive_file_name, pipeline_bucket_name)
        response = S3_CLIENT.upload_file(
            Filename=archive_file_name,
            Bucket=pipeline_bucket_name,
            Key="zipped/"+archive_file_name
        )

        execute_codepipeline(
            pipeline_name=CODEPIPELINE_NAME,
            client=CP_CLIENT
        )

    except Exception as e:
        logger.error("Error: %s", e)
        raise e
