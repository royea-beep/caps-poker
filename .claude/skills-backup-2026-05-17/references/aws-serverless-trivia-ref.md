# Simple Trivia Service - a Serverless Single- and Multi-player Trivia Game 

This example application shows how to build both single and multiplayer games using Serverless architectures and managed services from AWS.  Information about how this project works and how serverless architectures perform was published in the following blogs:
* [Building a serverless multi-player game that scales](https://aws.amazon.com/blogs/compute/building-a-serverless-multiplayer-game-that-scales/).
* [Building a serverless multi-player game that scales](https://aws.amazon.com/blogs/compute/building-a-serverless-multiplayer-game-that-scales-part-2/)

Important: this application uses various AWS services and there are costs associated with these services after the Free Tier usage - please see the [AWS Pricing page](https://aws.amazon.com/pricing/) for details. You are responsible for any AWS costs incurred. No warranty is implied in this example.

## Game Architecture

![Game Architecture of Simple Trivia Service](images/sts_architecture.png)

## Project Organization

```bash
.
├── README.MD                   <-- This instructions file
├── backend                     <-- Source code for the serverless backend
├── frontend                    <-- Source code for the Vue.js frontend
```

## Release Notes

### Backend
1. The backend of Simple Trivia Service uses TypeScript/Node 18.x and the AWS SDK v2. This is the start of the full conversion to TypeScript. Not everything uses strong types in Simple Trivia Service today. There are some updates that are being looked at, including GameSparks and Step Functions, and some DynamoDB table optimizations, These changes will have impact on the types that are used. Types are planned to be added with these updates.
2. The bakcend is now set up in multiple, separate templates and are no longer nested. This enables faster innovation for developers looking to quickly expirement with the solution.
3. The Game Detail table has been retired and questions are now stored in the Player Inventory table.
4. WebPush backend has been removed and notifications now use an IoT topic for the individual player.

### Front End
1. The front end has been updated to use Vue3/Vuetify3 and Node 18.x.


### Roadmap
The following items are on the roadmap to be introduced in future versions. If you are interested, please contact @timbrucemi on Twitter.

1. Versus mode - will use GameLift FlexMatch stand-alone matchmaking to to introduce a player vs. player timed mode.
2. Investigating updates and alternatives for backend services to manage game state while still remaining serverless. This will focus on single player, multiplayer websockets, and multiplayer IoT.
3. Additions of strong types for functions using `any` data types.
4. Automated localization of player generated content/chat. Stretch goal will include localization of front end.

## Requirements

1. An [AWS Account](https://portal.aws.amazon.com/gp/aws/developer/registration/index.html)
2. [AWS CLI v.2.7.21 installed](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-install.html) and [configured](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-configure.html) with Admin privileges
3. [AWS SAM CLI v1.78 installed](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html)
4. [NodeJS v18.x installed](https://nodejs.org/en/download/package-manager/)
5. [Vue.js and Vue CLI (v. 5.0.8) installed](https://vuejs.org/guide/quick-start.html)
6. [Create an IoT Endpoint in your account](https://docs.aws.amazon.com/iot/latest/developerguide/setting-up.html#iot-console-signin)
7. [jq is installed](https://stedolan.github.io/jq/download/)
7. Optional [AWS Amplify installed and configured to access the account you are using](https://docs.amplify.aws/cli/start/install)

## Installation Instructions

The installation instructions are broken down into two parts
    1. Simple Trivia Service backend deployment
    2. Simple Trivia Service frontend deployment

There are a number of steps in each part, which are described below.

### Backend Setup

This set of steps will deploy a number of AWS resources to your account, including DynamoDB tables, Lambda functions, API Gateway instances, and Cognito User Pools.

1. Create an [AWS Account](https://portal.aws.amazon.com/gp/aws/developer/registration/index.html) if you do not already have one.
2. Clone this repo using `git clone`.
3. Navigate to the `backend/Step1` directory. This template deploys DynamoDB Tables for Simple Trivia Service. Run the following commands:
   1. `sam deploy --stack-name sts-dt --guided` providing the following responses:
      1. Stack Name: `sts-dt`
      2. AWS Region: `<your region to deploy to, e.g. us-east-1>`
      3. Parameter LogRetentionDays: `7` or your value that follows [CloudWatch Log Retention Day Rules in CloudFormation](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-logs-loggroup.html#cfn-logs-loggroup-retentionindays)
      4. Parameter ResourceGroupPrefix: `GameService-DB`
      5. Confirm changes before deploy: `N`
      6. Allow SAM CLI IAM role creation: `Y`
      7. Disable rollback: `N`
      8. Save arguments to configuration file: `Y`
      9. SAM configuration file: `samconfig.toml`
      10. SAM configuration environment: `default`
4. Navigate to the `backend/Step2` directory. This template deploys some of the core utilities needed for Simple Trivia Service. Run the following commands:
   1. `sam build -u -p -t template.yaml`
   2. `sam deploy --stack-name sts --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM --guided` providing the following responses:
      1. Stack Name: `sts`
      2. AWS Region: `<your region to deploy to, e.g. us-east-1>`
      3. Parameter LogRetentionDays: `7` or your value that follows [CloudWatch Log Retention Day Rules in CloudFormation](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-logs-loggroup.html#cfn-logs-loggroup-retentionindays)
      4. Parameter ResourceGroupPrefix: `GameService`
      5. Parameter EMFNamespace: `STS`
      6. Confirm changes before deploy: `N`
      7. Allow SAM CLI IAM role creation: `Y`
      8. Disable rollback: `N`
      9. Save arguments to configuration file: `Y`
      10. SAM configuration file: `samconfig.toml`
      11. AM configuration environment: `default`
5. Navigate to the `backend/Step3` directory. This template deploys the analytics pipeline for Simple Trivia Service. Run the following commands:
   1. `sam build -u -p -t template.yaml`
   2. `sam deploy --stack-name sts-analytics --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM --guided` providing the following responses:
      1. Stack Name: `sts-analytics`
      2. AWS Region: `<your region to deploy to, e.g. us-east-1>`
      3. Parameter ResourceGroupPrefix: `GameService`
      4. Parameter ServicePrefix: `sts-analytics`
      5. Parameter S3BufferInterval: `60`
      6. Parameter S3BufferSize: `5`
      7. Parameter SourceStreamSize: `1`
      8. Confirm changes before deploy: `N`
      9. Allow SAM CLI IAM role creation: `Y`
      10. Disable rollback: `N`
      11. Save arguments to configuration file: `Y`
      12. SAM configuration file: `samconfig.toml`
      13. SAM configuration environment: `default`
6. Navigate to the `backend/Step4` directory. This template deploys the RESTful interface for Simple Trivia Service. Run the following commands:
   1. `sam build -u -p -t template.yaml`
   2. `sam deploy --stack-name sts-rest --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM --guided` providing the following responses:
      1. Stack Name: `sts-rest`
      2. AWS Region: `<your region to deploy to, e.g. us-east-1>`
      3. Parameter EMFNamespace: `STS`
      4. Parameter LogRetentionDays: `7` or your value that follows [CloudWatch Log Retention Day Rules in CloudFormation](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-logs-loggroup.html#cfn-logs-loggroup-retentionindays)
      5. Parameter ResourceGroupPrefix: `GameService`
      6. Confirm changes before deploy: `N`
      7. Allow SAM CLI IAM role creation: `Y`
      8. Disable rollback: `N`
      9. Save arguments to configuration file: `Y`
      10. SAM configuration file: `samconfig.toml`
      11. AM configuration environment: `default`
7. Navigate to the `backend/Step5` directory. This template deploys the API Gateway WebSockets solution for Simple Trivia Service. Run the following commands:
   1. `sam build -u -p -t template.yaml`
   2. `sam deploy --stack-name sts-ws --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM --guided` providing the following responses:
      1. Stack Name: `sts`
      2. AWS Region: `<your region to deploy to, e.g. us-east-1>`
      3. Parameter LogRetentionDays: `7` or your value that follows [CloudWatch Log Retention Day rules in CloudFormation](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-logs-loggroup.html#cfn-logs-loggroup-retentionindays)
      4. Parameter ResourceGroupPrefix: `GameService`
      5. Parameter EMFNamespace: `STS`
      6. Confirm changes before deploy: `N`
      7. Allow SAM CLI IAM role creation: `Y`
      8. Disable rollback: `N`
      9. Save arguments to configuration file: `Y`
      10. SAM configuration file: `samconfig.toml`
      11. AM configuration environment: `default`
8. Navigate to the `backend/Step6` directory. This template deploys the IoT WebSockets over MQTT solution for Simple Trivia Service. Run the following commands:
   1. `sam build -u -p -t template.yaml`
   2. `sam deploy --stack-name sts-iot --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM --guided` providing the following responses:
      1. Stack Name: `sts-iot`
      2. AWS Region: `<your region to deploy to, e.g. us-east-1>`
      3. Parameter LogRetentionDays: `7` or your value that follows [CloudWatch Log Retention Day Rules in CloudFormation](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-logs-loggroup.html#cfn-logs-loggroup-retentionindays)
      4. Parameter EMFNamespace: `STS`
      5. Confirm changes before deploy: `N`
      6. Allow SAM CLI IAM role creation: `Y`
      7. Disable rollback: `N`
      8. Save arguments to configuration file: `Y`
      9. SAM configuration file: `samconfig.toml`
      10. AM configuration environment: `default`
    Note: This stack may cause your security token to timeout. If so, you can track progress in the CloudFormation console.
9. Navigate to the `backend/Step7` directory. Run the script `generateAWSConfig.sh` to generate the AWSConfig.js file that you will need for the front end.
10. Copy the `AWSConfig.js` file you just created to `frontend/src/services/AWSConfig.js`.

### Frontend Setup

These steps will configure the Qwizardly UI to utilize the features deployed during the Backend Setup.
1. Navigate to the `serverless-trivia-game/frontend` directory.
2. Run the command `npm i` to install dependencies.
4. Run the command `npm run serve` to run the webapp locally.
5. Once the app is running, navigate to http://localhost:8080 to use the Simple Trivia Service frontend.

### Optional: Host the Simple Trivia Service frontend using Amplify

1. Navigate to the serverless-trivia-game/frontend/
2. Run the command `amplify init` to initialize the application and use the following values:
```
    Enter a name for the project: stsui
    Enter a name for the environment: dev
    Choose your default editor: (Use arrow keys to select your code editor)
    Choose the type of app that you're building: javascript
    What javascript framework are you using: vue
    Source Directory Path: src
    Distribution Directory Path: dist
    Build Command: npm run-script build
    Start Command: npm run-script serve
    Do you want to use an AWS profile? Y
    Please choose the profile you want to use: (select the profile you setup when configuring Amplify in the pre-requisites)
```
3. Run the command `amplify add hosting` to initiate the creation of hosting for the application.  Use the following options:
```
    Select the plugin module to execute: Hosting with Amplify Console (Managed hosting with custom domains, Continuous deployment)
    Choose a type: Manual deployment 
```
4. Run the command `amplify publish` to publish your application.  Amplify will return a URL like "https://dev.[amplifyid].amplify.com" where you can see the running application.

## Playing Simple Trivia Service

See the [Playing Simple Trivia Service](PLAYING_STS.md) file

## Next Steps

If you have any feedback, feature ideas, or updates, please reach out via a github issue or a pull request.  Note that you will need to offer the ability for AWS to use any code you submit.

## Clean-up

Remove the stack using the following commmands:

### Delete the Amplify Application
1. Type the command `amplify delete` from the serverless-trivia-game/frontend directory.

### Delete the Backend Services
1. Type the command `aws cloudformation delete-stack --stack-name sts-iot`
2. Type the command `aws cloudformation delete-stack --stack-name sts-ws`
3. Type the command `aws cloudformation delete-stack --stack-name sts-rest`
4. Type the command `aws cloudformation delete-stack --stack-name sts-analytics`
5. Type the command `aws cloudformation delete-stack --stack-name sts`
6. Type the command `aws cloudformation delete-stack --stack-name sts-dt`

Some of the stacks, namely sts-rest and sts-analtyics, contain S3 buckets that will not be deleted if they contain data. If this occurs to you, navigate to the CloudFormation console and find the stacks. Select the resources tab and carefully empty the buckets that remain as resources in the stack before trying to delete the stack again.


Copyright 2025 Amazon.com, Inc. or its affiliates. All Rights Reserved.

SPDX-License-Identifier: MIT-0/*
  Copyright 2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.
  Permission is hereby granted, free of charge, to any person obtaining a copy of this
  software and associated documentation files (the "Software"), to deal in the Software
  without restriction, including without limitation the rights to use, copy, modify,
  merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
  permit persons to whom the Software is furnished to do so.
  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
  INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
  PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
  HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
  OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
  SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

// SPDX-License-Identifier: MIT-0
// Function: send_chat:app.ts

/* eslint no-console: ["error", { allow: ["warn", "error"] }] */
import { SNSEvent, SNSMessage } from 'aws-lambda';
import { IoTDataPlaneClient, PublishCommand } from '@aws-sdk/client-iot-data-plane';

const region: string = process.env.REGION!;

const iotdata = new IoTDataPlaneClient({ region: region });

const sendIoTMessage = async(params: PublishCommand) => {
  try {
    await iotdata.send(params);
    return true;
  } catch (e) {
    console.error(`error sending to iot ${JSON.stringify(e)} ${JSON.stringify(params)}`);
    return false;
  }
}

const sendChat = async(channel: string, message: string) => {
  return await sendIoTMessage(new PublishCommand({
    topic: `chat/${channel}`,
    payload: new TextEncoder().encode(JSON.stringify({ message })),
    qos: 0,
  }));
}

exports.handler = async (event: SNSEvent) => {
  console.log(JSON.stringify(event));
  let message: SNSMessage = event.Records[0].Sns;
  const msg: string = message.Message!;
  const channel: string = message.Subject!;
  return await sendChat(channel, msg);
};
/*
  Copyright 2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.
  Permission is hereby granted, free of charge, to any person obtaining a copy of this
  software and associated documentation files (the "Software"), to deal in the Software
  without restriction, including without limitation the rights to use, copy, modify,
  merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
  permit persons to whom the Software is furnished to do so.
  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
  INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
  PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
  HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
  OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
  SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

// SPDX-License-Identifier: MIT-0
// Function: cognito_presignup:app.ts

/* eslint no-console: ["error", { allow: ["warn", "error"] }] */
import { PreSignUpTriggerEvent } from 'aws-lambda';

export const handler = (event: any, context: any, callback: any) => {
  event.response.autoConfirmUser = true;
  callback(null, event);
};
/*
  Copyright 2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.
  Permission is hereby granted, free of charge, to any person obtaining a copy of this
  software and associated documentation files (the "Software"), to deal in the Software
  without restriction, including without limitation the rights to use, copy, modify,
  merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
  permit persons to whom the Software is furnished to do so.
  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
  INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
  PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
  HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
  OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
  SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

// SPDX-License-Identifier: MIT-0
// Function: money_adjust:app.ts

/* eslint no-console: ["error", { allow: ["warn", "error"] }] */
import { SNSEvent, SNSMessage } from 'aws-lambda';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";

const playerWalletTableName: string = process.env.PLAYER_WALLET_TABLE_NAME!;
const playerWalletIdempotencyTableName: string = process.env.PLAYER_WALLET_IDEMPOTENCY_TABLE_NAME!;
const region: string = process.env.REGION!;
const ttlSetting = 300000;

const ddb = new DynamoDBClient({ region: region});
const ddbDocClient = DynamoDBDocumentClient.from(ddb, {
    marshallOptions: {
        removeUndefinedValues: true
    }
});

const clearIdempotency = async(msgId: string) => {
  try {
    await ddbDocClient.send(new DeleteCommand({
        TableName: playerWalletIdempotencyTableName,
        Key: { "msgId": msgId }
    }));
  } catch (error) {
    console.error(`could not clear idempotency record on error`)
    return;
  }
}

const idempotencyCheck =  async(msgId: string) => {
    const ttl: number = Math.floor(Date.now() / 1000) + ttlSetting;
    try {
      await ddbDocClient.send(new PutCommand({
        TableName: playerWalletIdempotencyTableName,
        Item: { msgId: msgId, expiration: ttl },
        ConditionExpression: "attribute_not_exists(messageId)"
      }))
      return false;
    } catch (error) {
      if (error.name === "ConditionalCheckFailedException") {
        return true;
      }
      throw error;
    }
}


const addToWallet = async(msgId: string, playerName: string, amount: number, action: string) => {
  let result;
  let item;
  if(idempotencyCheck(msgId)) {
    try {
      result = await ddbDocClient.send(new GetCommand(
        { TableName: playerWalletTableName,
        Key: { playerName }}
        ));
      if (result.Item) {
        item = result.Item;
        if (action === 'subtract') {
          amount *= -1;
        }
        item.amount += amount;
        result = await ddb.send(new PutCommand({ TableName: playerWalletTableName, Item: item }));
        return { statusCode: 200, body: JSON.stringify(result) };
      } else {
        item = { playerName, amount };
        result = await ddb.send(new PutCommand({ TableName: playerWalletTableName, Item: item }));
        return { statusCode: 200, body: JSON.stringify(result) };
      }
    } catch (e) {
      console.error(`Could not add to player wallet ${playerName} ${JSON.stringify(e.stack)}`);
      clearIdempotency(msgId);
      return { statusCode: 500, body: 'Error adding to player wallet' };
    }
  }
}

export const handler = async (event: SNSEvent) => {
  let message: SNSMessage = event.Records[0].Sns;
  const msgId = message.MessageId;
  const playerName: string = message.MessageAttributes.playerId?.Value!;
  const amount: number = +message.MessageAttributes.amount?.Value;
  const action: string = message.MessageAttributes.action?.Value!;
  return await addToWallet(msgId, playerName, amount, action);
};
/*
  Copyright 2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.
  Permission is hereby granted, free of charge, to any person obtaining a copy of this
  software and associated documentation files (the "Software"), to deal in the Software
  without restriction, including without limitation the rights to use, copy, modify,
  merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
  permit persons to whom the Software is furnished to do so.
  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
  INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
  PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
  HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
  OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
  SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

// SPDX-License-Identifier: MIT-0
// Function: playerprogression_put:app.ts

/* eslint no-console: ["error", { allow: ["warn", "error"] }] */
import { SNSEvent, SNSMessage } from 'aws-lambda';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";

const playerProgressTable = process.env.PLAYER_PROGRESS_TABLE_NAME!;
const playerProgressIdemopotencyTable = process.env.PLAYER_PROGRESS_IDEMPOTENCY_TABLE_NAME!;
const region = process.env.REGION;
const ttlSetting = 300000;

const ddb = new DynamoDBClient({ region: region});
const ddbDocClient = DynamoDBDocumentClient.from(ddb, {
    marshallOptions: {
        removeUndefinedValues: true
    }
});

const clearIdempotency = async(msgId: string) => {
  try {
    await ddbDocClient.send(new DeleteCommand({
        TableName: playerProgressIdemopotencyTable,
        Key: { "msgId": msgId }
    }));
  } catch (error) {
    console.error(`could not clear idempotency record on error`)
    return;
  }
}

const idempotencyCheck =  async(msgId: string) => {
    const ttl: number = Math.floor(Date.now() / 1000) + ttlSetting;
    try {
      await ddbDocClient.send(new PutCommand({
        TableName: playerProgressIdemopotencyTable,
        Item: { msgId: msgId, expiration: ttl },
        ConditionExpression: "attribute_not_exists(messageId)"
      }))
      return false;
    } catch (error) {
      if (error.name === "ConditionalCheckFailedException") {
        return true;
      }
      throw error;
    }
}

const getLevel = async(xp: number) => {
  const levels = [100, 250, 500, 800, 1100, 1500, 3000, 10000, 25000, 50000];
  for (let i = 0; i < levels.length; i += 1) {
    if (xp < levels[i]) {
      return i;
    }
  }
}

const updateXP = async(playerName: string, experience: number, wins: number) => {
  let current;
  if(!playerName || playerName === '') {
    return;
  }
  try {
    current = await ddbDocClient.send(new GetCommand({
      TableName: playerProgressTable,
      Key : { playerName: playerName },
    }));
    if(!current.Item) {
      // no item was retrieved - player has no current progress
      const level = await getLevel(experience);
      const result = await ddbDocClient.send(new PutCommand({ 
        TableName: playerProgressTable,
        Item: {
          playerName, experience, level, wins,
        },
      }));
    } else {
      const newxp = current.Item.experience + experience;
      const newwins = current.Item.wins + wins;
      const newlevel = await getLevel(newxp);
      await ddb.send(new UpdateCommand({
        TableName: playerProgressTable,
        Key: { playerName: playerName },
        ExpressionAttributeNames: { '#xp': 'experience', '#lvl': 'level', '#wins': 'wins' },
        ExpressionAttributeValues: {
          ':xp': newxp, ':lvl': newlevel, ':wins': newwins, ':curxp': current.Item.experience,
        },
        ConditionExpression: '#xp = :curxp',
        UpdateExpression: 'set #xp = :xp, #lvl = :lvl, #wins = :wins',
      }));
      return;
    }
  } catch (e) {
    console.error(`Error setting player progress ${JSON.stringify(e.stack)}`);
    return;
  }
}

export const handler = async (event: SNSEvent) => {
  const message: SNSMessage = event.Records[0].Sns;
  const msgId = message.MessageId;
  const msg = JSON.parse(message.Message);
  if (idempotencyCheck(msgId)) {
    await Promise.all([
      updateXP(msg.playerid, msg.experience, msg.wins),
      updateXP(msg.owner, msg.experience, 0),
    ])
      .catch((e) => {
        clearIdempotency(msgId);
        console.error(`Error logging ${e.stack}`)});
  }
};
/*
  Copyright 2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.
  Permission is hereby granted, free of charge, to any person obtaining a copy of this
  software and associated documentation files (the "Software"), to deal in the Software
  without restriction, including without limitation the rights to use, copy, modify,
  merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
  permit persons to whom the Software is furnished to do so.
  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
  INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
  PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
  HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
  OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
  SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

// SPDX-License-Identifier: MIT-0
// Function: score_put:app.ts

/* eslint no-console: ["error", { allow: ["warn", "error"] }] */
import { SNSEvent, SNSMessage } from 'aws-lambda';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

const scoresTableName = process.env.SCORES_TABLE_NAME!;
const region = process.env.REGION!;

const marshallOptions = {
  convertEmptyValues: false, // false, by default.
  removeUndefinedValues: true, // false, by default.
  convertClassInstanceToMap: false, // false, by default.
};

const unmarshallOptions = {
  wrapNumbers: false, // false, by default.
};

const translateConfig = { marshallOptions, unmarshallOptions };

const ddb = new DynamoDBClient({ region: region});
const ddbDocClient = DynamoDBDocumentClient.from(ddb, translateConfig);

const updateScoreboard = async(gameId: string, quizName: string, playerName: string, score: number) => {
  try {
    const scoreData = await ddbDocClient.send( new GetCommand({
      TableName: scoresTableName,
      Key: { gameId, playerName }, 
    }));
    if (!scoreData.Item) {
      // store the record only if player has not taken the quiz
      await ddbDocClient.send(new PutCommand({
        TableName: scoresTableName,
        Item: { gameId, quizName, playerName, score },
      }));
      return { statusCode: 200, body: 'score saved' };
    } else {
      return { statusCode: 200, body: 'score existed' };
    }
  } catch (e) {
    console.error(`could not get score info ${JSON.stringify(e.stack)}`);
    return { statusCode: 500, body: 'Error getting score' };
  }
}

export const handler = async (event: SNSEvent) => {
  console.log(`${JSON.stringify(event)}`);
  let message: SNSMessage = event.Records[0].Sns;
  const msg: any = JSON.parse(message.Message);
  return await updateScoreboard(msg?.gameId, msg?.quizName, msg?.playerid,
    msg?.score);
};
/*
  Copyright 2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.
  Permission is hereby granted, free of charge, to any person obtaining a copy of this
  software and associated documentation files (the "Software"), to deal in the Software
  without restriction, including without limitation the rights to use, copy, modify,
  merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
  permit persons to whom the Software is furnished to do so.
  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
  INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
  PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
  HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
  OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
  SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

// SPDX-License-Identifier: MIT-0
// Function: activegames_list:app.ts

/* eslint no-console: ["error", { allow: ["warn", "error"] }] */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, BatchWriteCommand  } from "@aws-sdk/lib-dynamodb";

const tableName: string = process.env.TABLE_NAME!;
const region: string = process.env.REGION!;

const marshallOptions = {
  convertEmptyValues: false, // false, by default.
  removeUndefinedValues: true, // false, by default.
  convertClassInstanceToMap: false, // false, by default.
};

const unmarshallOptions = {
  wrapNumbers: false, // false, by default.
};


const ddb = new DynamoDBClient({ region: region});
const ddbClient = DynamoDBDocumentClient.from(ddb, {
  marshallOptions,
  unmarshallOptions,
});

export const handler = (event: any, context: any, callback: any) => {
    const requestItems = buildRequestItems(event.Records);
    const requests = buildRequests(requestItems);
    
    Promise.all(requests)
      .then(() => callback(null, `Delivered ${event.Records.length} records`))
      .catch(callback);
};

const buildRequestItems = (records: any) => {
  return records.map((record: any) => {
    const json = Buffer.from(record.kinesis.data, 'base64').toString('ascii');
    const item = JSON.parse(json);
    console.log(item)
  
    return {
      PutRequest: {
        Item: item,
      },
    };
  });
}

const buildRequests = (requestItems: any) => {
  const requests = [];
  
  while (requestItems.length > 0) {
    const request = batchWrite(requestItems.splice(0, 25));
  
    requests.push(request);
  }
  
  return requests;
}

const batchWrite = async (requestItems: any, attempt = 0): Promise<any> => {
  const params: any = {
      RequestItems: {
        [tableName]: requestItems 
      },
    };

  let delay = 0;
  
  if (attempt > 0) {
    delay = 50 * Math.pow(2, attempt);
  }
  
  return new Promise(function(resolve: any, reject: any) {
    setTimeout(function() {
      try {
        const data: any = ddbClient.send(new BatchWriteCommand(params));
        if (data.UnprocessedItems.hasOwnProperty(tableName)) {
          reject;
          return batchWrite(data.UnprocessedItems[tableName], attempt + 1);
        }
        resolve;
      } catch(e) {
        reject;
        return;
      }
    }, delay);
  });
}
/*
  Copyright 2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.
  Permission is hereby granted, free of charge, to any person obtaining a copy of this
  software and associated documentation files (the "Software"), to deal in the Software
  without restriction, including without limitation the rights to use, copy, modify,
  merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
  permit persons to whom the Software is furnished to do so.
  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
  INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
  PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
  HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
  OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
  SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

// SPDX-License-Identifier: MIT-0
// Function: activegames_delete:app.ts

/* eslint no-console: ["error", { allow: ["warn", "error"] }] */
import { EventBridgeEvent } from 'aws-lambda';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
/*const { Unit } = require('aws-embedded-metrics');
const { logMetricEMF } = require('/opt/logger');*/

const playerInventoryTableName: string = process.env.PLAYER_INVENTORY_TABLE_NAME!;
const region: string = process.env.REGION!;

const ddb = new DynamoDBClient({ region: region});
const ddbDocClient = DynamoDBDocumentClient.from(ddb);

async function removeLiveGamePlayer(gameId: string, playerName: string) {
  if(!playerName || !gameId) {
    console.error(`missing key data ${playerName} - ${gameId}`);
    return;
  }
  try {
    await ddbDocClient.send( new UpdateCommand({TableName: playerInventoryTableName,
      Key: {pk: playerName, sk: gameId},
      UpdateExpression: 'REMOVE gameType, starttime, hostName'
    }));
  } catch(e) {
    console.error(`error removing hosted game ${JSON.stringify(e)}`);
  }
}

async function removeLiveGame(event: EventBridgeEvent<any, any>) {
  console.log(`removing live game data`)
  const playerName = event.detail?.playerName;
  const gameId = event.detail?.gameId;
  console.log(`${playerName} - ${gameId}`)
  if(!playerName || !gameId) {
    console.error(`missing key data ${playerName} - ${gameId}`);
    return;
  }
  try {
    await ddbDocClient.send( new UpdateCommand({TableName: playerInventoryTableName,
      Key: {pk: playerName, sk: gameId},
      UpdateExpression: 'REMOVE gameType, starttime, hostName'
    }));
  } catch(e) {
    console.error(`error removing hosted game ${JSON.stringify(e)}`);
  }
}

async function removeLiveForPlayer(event: EventBridgeEvent<any, any>) {
  const playerName = event.detail?.playerName;
  if(!playerName) {
    console.error(`missing key data ${playerName}`);
    return;
  }
  try {
    const otherLiveGames = await ddb.send(new QueryCommand({
      TableName: playerInventoryTableName, IndexName: 'gsi-GameType',
      KeyConditionExpression:'gameType=:gameType',
      ExpressionAttributeValues:{':gameType':'LIVE='+playerName}
    }));
    console.log(`${JSON.stringify(otherLiveGames)}`);
    if(otherLiveGames.Count && otherLiveGames.Items) {
      for(var i: number=0;i<+otherLiveGames.Count;i++) {
          await removeLiveGamePlayer(otherLiveGames.Items[i].pk, otherLiveGames.Items[i].sk);
      }
    } else {
      return true;
    }
  } catch(e) {
    console.error(`error querying for live games ${e}`);
    return false;
  }
}

export const handler = async (event: EventBridgeEvent<any, any>) => {
    console.log(`${JSON.stringify(event)}`);
    const gameId = event.detail?.gameId;
    if(gameId) {
      return await removeLiveGame(event);
    } else {
      return await removeLiveForPlayer(event);
    }
};/*
  Copyright 2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.
  Permission is hereby granted, free of charge, to any person obtaining a copy of this
  software and associated documentation files (the "Software"), to deal in the Software
  without restriction, including without limitation the rights to use, copy, modify,
  merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
  permit persons to whom the Software is furnished to do so.
  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
  INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
  PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
  HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
  OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
  SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

// SPDX-License-Identifier: MIT-0
// Function: activegames_list:app.ts

/* eslint no-console: ["error", { allow: ["warn", "error"] }] */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { cors } from "@lambda-middleware/cors";

const playerInventoryTableName: string = process.env.PLAYER_INVENTORY_TABLE_NAME!;
const region: string = process.env.REGION!;
const mainCorsDomain: string = process.env.MAIN_CORS_DOMAIN!;

let mainCorsDomainArray: Array<string> = [];
if (mainCorsDomain !== "*") {
  mainCorsDomainArray.push(mainCorsDomain)
} 

const ddb = new DynamoDBClient({ region: region});
const ddbDocClient = DynamoDBDocumentClient.from(ddb);

const getActiveGames = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const host = event.queryStringParameters?.host;
    const category = event.queryStringParameters?.category;

    if(!host && !category) {
      return { statusCode: 200, body: 'Please include proper query parameters' }
    }
    
    if(host) {
      const gameType = 'LIVE='+host;
      console.log(`getting ${gameType}`);
      //perform the query on the GSI for the record and return it
      const parms = 
        {TableName: playerInventoryTableName,
          IndexName: 'gsi-GameType',
          KeyConditionExpression: 'gameType = :gameType',
          ExpressionAttributeValues: {':gameType': gameType }
        }
      try {
        const result = await ddbDocClient.send(new QueryCommand(parms));
        return { statusCode: 200, body: JSON.stringify(result.Items) }
      }
      catch(e) {
          console.error(`error getting live game ${e}`);
          return { statusCode: 500, body: 'Could not retrieve game' };
      }
    } else {
      const gameType = 'SINGLE='+category;
      console.log(`getting ${gameType}`);
      //perform the query on the GSI for the record and return it
      const parms = 
        {TableName: playerInventoryTableName,
          IndexName: 'gsi-GameType',
          KeyConditionExpression: 'gameType = :gameType',
          ExpressionAttributeValues: {':gameType': gameType }
        };
      try {
        const result = await ddbDocClient.send(new QueryCommand(parms));
        return { statusCode: 200, body: JSON.stringify(result.Items) }
      }
      catch(e) {
          console.error(`error getting live game ${e}`);
          return { statusCode: 500, body: 'Could not retrieve game' };
      }
    }
}

const originLambdaHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    console.log(`${JSON.stringify(event)}`);
    return await getActiveGames(event);
};

export const handler = cors({
  allowCredentials: true,
  allowedOrigins: mainCorsDomainArray,
  allowedMethods: [
    'OPTIONS',
    'HEAD',
    'GET',
  ],
  allowedHeaders: [
    'Authorization',
    'Content-Type',
  ]
})(originLambdaHandler)import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { AuthResponse, CustomAuthorizerEvent, PolicyDocument } from 'aws-lambda';
import jwt from 'jsonwebtoken';

const userPoolId: string = process.env.USERPOOLID!;
const appClientId: string = process.env.APPCLIENTID!;
const region: string = process.env.REGION!;

const jwtVerifier = CognitoJwtVerifier.create({
  userPoolId: userPoolId,
  tokenUse: "id",
  clientId: appClientId
});

function generatePolicy (effect: string, accountId: string, apiId: string, stage: string): PolicyDocument {
  
  const resource = `arn:aws:execute-api:${region}:${accountId}:${apiId}/${stage}/*/*`
  
  if (effect) {
    const policyDocument: PolicyDocument = {
        'Version': '2012-10-17',
        'Statement': [
            {
            'Action': 'execute-api:Invoke',
            'Effect': effect,
            'Resource': resource
            }
        ]
    }
    return policyDocument;
  } else {
    const policyDocument: PolicyDocument = {
        'Version': '2012-10-17',
        'Statement': [
            {
            'Action': 'execute-api:Invoke',
            'Effect': 'Deny',
            'Resource': resource
            }
        ]
    }
    return policyDocument;      
  }
}

export const handler = async (event: CustomAuthorizerEvent): Promise<AuthResponse> => {
  const idToken: string = event.headers?.authorization!;
  console.log(JSON.stringify(event));
  const decoded = await jwt.decode(idToken, {'complete': true});
  let sub :string = 'me';
  if (decoded?.payload && decoded.payload?.sub) {
    sub = decoded.payload.sub as string;
  }
  try {
    // If the token is not valid, an error is thrown:
    const payload = await jwtVerifier.verify(idToken);
    console.log(JSON.stringify(payload));
    const accountId: string = event.requestContext?.accountId!;
    const apiId: string = event.requestContext?.apiId!;
    const stage: string = event.requestContext?.stage!;

    const policyDoc = generatePolicy('Allow', accountId, apiId, stage);
    console.log(JSON.stringify(policyDoc));
    return {
      principalId: sub,
      policyDocument: policyDoc
    } as AuthResponse
  } catch(e) {
    // API Gateway wants this *exact* error message, otherwise it returns 500 instead of 401:
    console.log(`error: ${JSON.stringify(e)}`)
    throw new Error("Unauthorized");
  }
};/*
  Copyright 2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.
  Permission is hereby granted, free of charge, to any person obtaining a copy of this
  software and associated documentation files (the "Software"), to deal in the Software
  without restriction, including without limitation the rights to use, copy, modify,
  merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
  permit persons to whom the Software is furnished to do so.
  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
  INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
  PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
  HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
  OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
  SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/
// SPDX-License-Identifier: MIT-0
// Function: gameheader_put:app.js

/* eslint no-console: ["error", { allow: ["warn", "error"] }] */
/* eslint no-param-reassign: ["error", { "props": true,
"ignorePropertyModificationsFor": ["gameData"] }] */
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { cors } from "@lambda-middleware/cors";
import { v4 as uuidv4 } from 'uuid';

const playerInventoryTableName: string = process.env.PLAYER_INVENTORY_TABLE!;
const region: string = process.env.REGION!;
const mainCorsDomain: string = process.env.MAIN_CORS_DOMAIN!;

let mainCorsDomainArray: Array<string> = [];
if (mainCorsDomain !== "*") {
  mainCorsDomainArray.push(mainCorsDomain)
} 
const ddb = new DynamoDBClient({ region: region});
const ddbDocClient = DynamoDBDocumentClient.from(ddb);

const saveGameHeader = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  let gameData: any;
  if(event.body) {
    gameData = JSON.parse(event.body);
  }
  if(!gameData.gameId) {
    gameData.gameId = uuidv4();
    gameData.sk = gameData.gameId;
  }
  try {
    await ddbDocClient.send(new PutCommand ({
      TableName: playerInventoryTableName,
      Item: gameData,
    }))
    return { statusCode: 200, body: JSON.stringify({ gameId: gameData.gameId }) };
  } catch (e) {
    console.error(`Could not save game header ${JSON.stringify(e)}`);
    return { statusCode: 500, body: JSON.stringify({ message: 'Could not save game header' }) };
  }
}

const originLambdaHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log(`${JSON.stringify(event)}`);
  return await saveGameHeader(event);
};

export const handler = cors({
  allowCredentials: true,
  allowedOrigins: mainCorsDomainArray,
  allowedMethods: [
    'OPTIONS',
    'HEAD',
    'GET',
  ],
  allowedHeaders: [
    'Authorization',
    'Content-Type',
  ]
})(originLambdaHandler)