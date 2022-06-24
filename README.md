# zip-code-cloudflare-kv

Fill a Cloudflare KV namespace with ZIP Code details, e.g. for lookup from a Worker.

The basic idea is to create a Workers KV namespace, then run this CLI tool to fill it with data, then bind your Worker to that KV namespace to fetch ZIP Code data.

## Using in a Worker

Data is written with a few different prefixes, to support different lookups, but here's a simple example of using this data in a Worker that has a namespace bound to `ZIPS` and uses the [modules](https://blog.cloudflare.com/workers-javascript-modules/) format:

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

Use the CLI to fill an existing KV namespace with data, or use it to generate and write out a JSON file that you use with the [Wrangler `kv:bulk put`](https://developers.cloudflare.com/workers/wrangler/cli-wrangler/commands/#kvbulk) command.

### `fill`

This will write values to your existing KV namespace.

```bash
zip-code-cloudflare-kv fill # TODO
```

Here are the available options:

```js
// TODO
```

### `json`

This will write a JSON file to disk with the list of all KV entries.

```bash
zip-code-cloudflare-kv json /path/to/file.json
```

Here are the available options:

```js
// TODO
```

## The Keys

Data is generated using [nrviens/zipcodes](https://github.com/nrviens/zipcodes), and written with a few different access patterns in mind.

### Parameters

###### `<COUNTRY>`

Available country codes:

- `US` - United States

> **Note:** If you are interested in adding other countries, please [open an issue](https://github.com/saibotsivad/zip-code-cloudflare-kv/issues) to discuss it first.

###### `<STATE_CODE>`

The shortened code for the state, e.g. California is `CA`.

###### `<ZIP>`

The ZIP string is country-dependent.

- `US` - The 5-digit ZIP code numbers, e.g. `08644`.

### Keys

#### `<COUNTRY>:item:code:<ZIP>`

This will give you the detailed information for that ZIP Code, in that country. For example, the key `US:code:08644` would give you:

```json
{
	"zip": "08644",
	"latitude": 40.2171,
	"longitude": -74.7429,
	"city": "Trenton",
	"state": "NJ",
	"country": "US"
}
```

## License

Published and released under the [Very Open License](http://veryopenlicense.com).

If you need a commercial license, [contact me here](https://davistobias.com/license?software=zip-code-cloudflare-kv).
