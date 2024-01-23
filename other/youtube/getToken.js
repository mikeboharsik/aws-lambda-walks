const { execSync } = require('child_process');
const http = require('http');

const [,, clientId, clientSecret] = process.argv;

(async function(){	
	const params = {
		access_type: 'offline',
		client_id: clientId,
		include_granted: true,
		redirect_uri: 'http://localhost:8080',
		response_type: 'code',
		scope: 'https://www.googleapis.com/auth/youtube',
	};
	
	const processedParams = Object.keys(params).reduce((acc, cur) => acc + `&${cur}=${params[cur]}`, '');
	const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${processedParams}`.replace(/&/g, '^&');
	
	const command = `start ${authUrl}`;
	execSync(command);
	
	const job = new Promise(async (resolve, reject) => {
		try {
			const server = http.createServer(async (req, res) => {
				const url = req.url;
				
				const match = url.match(/(code)=(.*?)(&|$)/);
				if (match) {
					const [, , code] = match;
					
					res.end('<html>Close this</html>');
					
					const oauthParams = {
						client_id: clientId,
						client_secret: clientSecret,
						grant_type: 'authorization_code',
						redirect_uri: params.redirect_uri,
					};
					
					const processedOauthParams = Object.keys(oauthParams).reduce((acc, cur) => acc + `&${cur}=${oauthParams[cur]}`, '');
					
					const oauthUrl = `https://oauth2.googleapis.com/token?code=${code}${processedOauthParams}`;
					const oauthRes = await fetch(oauthUrl, { method: 'POST' }).then(r => r.json());
					
					server.closeAllConnections();
					server.close();
					
					resolve(oauthRes.access_token);
					console.log(oauthRes.access_token);
				} else {
					res.end();
				}
			}).listen(8080);
		} catch (e) {
			reject(e);
		}
	});
	
	return await job;
})();