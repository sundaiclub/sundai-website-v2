import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fromIni } from '@aws-sdk/credential-provider-ini';
import {
  S3Client,
  CreateBucketCommand,
  HeadBucketCommand,
  PutPublicAccessBlockCommand,
  PutBucketOwnershipControlsCommand,
  PutBucketEncryptionCommand,
  PutBucketVersioningCommand,
  PutBucketCorsCommand,
} from '@aws-sdk/client-s3';

async function main() {
  const Bucket = 'sundai-materials-426771917681';
  const client = new S3Client({
    region: 'us-east-1',
    credentials: fromIni({ profile: process.env.AWS_PROFILE || 'default' }),
  });
  try {
    try {
      await client.send(new HeadBucketCommand({ Bucket }));
    } catch (error: any) {
      if (error.$metadata?.httpStatusCode !== 404) throw error;
      await client.send(
        new CreateBucketCommand({
          Bucket,
          ObjectOwnership: 'BucketOwnerEnforced',
        })
      );
    }
    await client.send(
      new PutPublicAccessBlockCommand({
        Bucket,
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          IgnorePublicAcls: true,
          BlockPublicPolicy: true,
          RestrictPublicBuckets: true,
        },
      })
    );
    await client.send(
      new PutBucketOwnershipControlsCommand({
        Bucket,
        OwnershipControls: {
          Rules: [{ ObjectOwnership: 'BucketOwnerEnforced' }],
        },
      })
    );
    await client.send(
      new PutBucketEncryptionCommand({
        Bucket,
        ServerSideEncryptionConfiguration: {
          Rules: [
            { ApplyServerSideEncryptionByDefault: { SSEAlgorithm: 'AES256' } },
          ],
        },
      })
    );
    await client.send(
      new PutBucketVersioningCommand({
        Bucket,
        VersioningConfiguration: { Status: 'Enabled' },
      })
    );
    await client.send(
      new PutBucketCorsCommand({
        Bucket,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedOrigins: [
                'https://sundai.club',
                'https://www.sundai.club',
              ],
              AllowedMethods: ['PUT'],
              AllowedHeaders: ['content-type'],
              MaxAgeSeconds: 300,
            },
          ],
        },
      })
    );
    // Separate inline policy: keep the existing image upload policy and OIDC trust.
    execFileSync(
      'aws',
      [
        'iam',
        'put-role-policy',
        '--profile',
        process.env.AWS_PROFILE || 'default',
        '--role-name',
        'sundai-images-production',
        '--policy-name',
        'ManagePrivateEventMaterials',
        '--policy-document',
        readFileSync('docs/s3-materials-production-policy.json', 'utf8'),
      ],
      { stdio: ['ignore', 'inherit', 'inherit'] }
    );
    console.log(
      `Private materials bucket and role policy configured: ${Bucket}. Configure S3_MATERIALS_* in Vercel before deployment.`
    );
  } finally {
    client.destroy();
  }
}
main().catch(error => {
  console.error(error instanceof Error ? error.message : 'Setup failed');
  process.exitCode = 1;
});
