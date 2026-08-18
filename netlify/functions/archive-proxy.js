const DEFAULT_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Range, Content-Range, Content-Type, Authorization',
  'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges'
};

async function fetchRemoteBinary(url, rangeHeader) {
  const requestHeaders = {
    'User-Agent': 'Mozilla/5.0',
    'Accept': '*/*'
  };

  if (rangeHeader) {
    requestHeaders.Range = rangeHeader;
  }

  const response = await fetch(url, {
    headers: requestHeaders,
    redirect: 'follow'
  });

  const bodyBuffer = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get('content-type') || 'application/octet-stream';
  const contentRange = response.headers.get('content-range') || null;
  const acceptRanges = response.headers.get('accept-ranges') || 'bytes';

  return {
    statusCode: response.status,
    headers: {
      ...DEFAULT_HEADERS,
      'Content-Type': contentType,
      'Accept-Ranges': acceptRanges,
      ...(contentRange ? { 'Content-Range': contentRange } : {}),
      ...(response.headers.get('content-length') ? { 'Content-Length': response.headers.get('content-length') } : {}),
      ...(bodyBuffer.length ? { 'Content-Length': String(bodyBuffer.length) } : {})
    },
    body: bodyBuffer,
    isBase64Encoded: true
  };
}

exports.handler = async function handler(event) {
  const headers = { ...DEFAULT_HEADERS };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  const targetUrl = event.queryStringParameters && event.queryStringParameters.url
    ? decodeURIComponent(event.queryStringParameters.url)
    : null;

  if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Missing or invalid url parameter' })
    };
  }

  try {
    const rangeHeader = event.headers && (event.headers.range || event.headers.Range || null);
    const result = await fetchRemoteBinary(targetUrl, rangeHeader);

    if (event.httpMethod === 'HEAD') {
      return {
        statusCode: result.statusCode,
        headers: result.headers,
        body: ''
      };
    }

    return {
      statusCode: result.statusCode,
      headers: result.headers,
      isBase64Encoded: true,
      body: result.body.toString('base64')
    };
  } catch (error) {
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({ error: 'Archive proxy failed', message: error.message })
    };
  }
};
