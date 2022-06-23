# zip-code-cloudflare-kv

Fill a Cloudflare KV namespace with ZIP Code details, e.g. for lookup from a Worker.

The basic idea is to create a Workers KV namespace, then run this CLI tool to fill it with data, then bind your Worker to that KV namespace to fetch ZIP Code data.

Data is written with a few different prefixes, to support different lookups, but here's a simple example that has a namespace bound to `ZIPS` and uses the [modules](https://blog.cloudflare.com/workers-javascript-modules/) format:

```js
const BEVERLY_HILLS = '90210'

export default {
	async fetch(request, env) {
		const data = env.ZIPS.get(BEVERLY_HILLS, {
			// All data is stored in JSON format.
			type: 'json',
			// Since this data doesn't change frequently, we can reduce
			// cold read latency by setting a long cache.
			// https://developers.cloudflare.com/workers/runtime-apis/kv/#cache-ttl
			cacheTtl: 86400, // 24 hours
		})
		return new Response()
	},
}
```

## Install

The usual way:

```bash
npm install --save-dev zip-code-cloudflare-kv
```

Since this functions as a CLI tool, you can also use [npx](https://docs.npmjs.com/cli/v7/commands/npx) and do:

```bash
npx zip-code-cloudflare-kv
```

## The CLI

Use the CLI to fill an existing KV namespace with data:

```bash
zip-code-cloudflare-kv fill # TODO
```

Here are the available options:

```js
// TODO
```

## Using



## License

Published and released under the [Very Open License](http://veryopenlicense.com).

If you need a commercial license, [contact me here](https://davistobias.com/license?software=zip-code-cloudflare-kv).

Data is sourced from these locations:

- TODO
