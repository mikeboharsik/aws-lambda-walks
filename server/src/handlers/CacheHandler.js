const { CloudFrontClient, CreateInvalidationCommand } = require('@aws-sdk/client-cloudfront');

const { ApiRequestHandler } = require('./ApiRequestHandler');

class CacheHandler extends ApiRequestHandler {
	constructor() {
		super();
		this.path = /^\/cache$/;
		this.requiresAuth = true;
	}

	async process(event) {
		const { body: { paths = null } = {} } = event;
	
		if (!paths) {
			return this.getJsonResponse(400, JSON.stringify({ error: 'paths is missing from the request body' }));
		}
	
		const cfInput = {
			DistributionId: process.env.CLOUDFRONT_DISTRIBUTION_ID,
			InvalidationBatch: {
				CallerReference: new Date().getTime().toString(),
				Paths: {
					Items: paths,
					Quantity: paths.length,
				}
			}
		};
	
		const cfClient = new CloudFrontClient({ region: process.env.AWS_REGION });
		const cfCommand = new CreateInvalidationCommand(cfInput);
	
		event.log(`Invalidating CloudFront cache using command:\n${JSON.stringify(cfCommand)}`);
		const result = JSON.stringify(await cfClient.send(cfCommand));
		event.log('Invalidation result', result);
	
		return this.getJsonResponse(200, result);
	}
};

module.exports = {
	CacheHandler
};
