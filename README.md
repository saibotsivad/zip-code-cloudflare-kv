# zip-code-cloudflare-kv

Fill a Cloudflare KV namespace with 42,555 United States ZIP Code details, e.g. for lookup from a Worker.

The basic idea is to create a Workers KV namespace, then run this CLI tool to fill it with data, then bind your Worker to that KV namespace to fetch ZIP Code data.

## Using in a Worker

Data is written with prefixes to support different lookup strategies, but here's a simple example of using this data in a Worker that has a namespace bound to `ZIPS` and uses the [modules](https://blog.cloudflare.com/workers-javascript-modules/) format:

```js
const COUNTRY = 'US'
const BEVERLY_HILLS = '90210'
const KEY = `${COUNTRY}:i:zip:${BEVERLY_HILLS}`

export default {
	async fetch(request, env) {
		const data = env.ZIPS.get(KEY, {
			// All data is stored in JSON format.
			type: 'json',
			// Since this data doesn't change frequently, we can reduce
			// cold read latency by setting a long cache.
			// https://developers.cloudflare.com/workers/runtime-apis/kv/#cache-ttl
			cacheTtl: 86400, // 24 hours
		})
		/*
		data = {
			zip: '90210',
			latitude: 34.0901,
			longitude: -118.4065,
			city: 'Beverly Hills',
			state: 'CA',
			country: 'US'
		}
		*/
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

#### `fill`

This will write values to your existing KV namespace. This is not something to do frequently, since writing all data to KV takes about 10 minutes on a reasonable internet connection.

```bash
zip-code-cloudflare-kv fill <namespaceId>
```

You must set the API token using the environment variable `CF_API_TOKEN`, and you must set the Cloudflare account id using either the `--accountId` option or the `CF_ACCOUNT_ID` environment variable.

The parameter descriptions:

* `<namespaceId>` - The identifier of the KV namespace to fill with data.

Here are the available options:

* `-a` / `--accountId` - Set the Cloudflare account id to use. This will override the default, which is to use the environment variable `CF_ACCOUNT_ID`.
* `-p` / `--prefix` - Add a prefix to all items. For example, if the KV namespace is shared with other data you might use `-p "zips:"`, which would change `US:i:zip:90210` to `zips:US:i:zip:90210`.

#### `json`

This will write a JSON file to disk with the list of all KV entries.

```bash
zip-code-cloudflare-kv json /path/to/file.json
```

Here are the available options:

* `-p` / `--prefix` - Add a prefix to all items, the same as the `fill` command option.

#### `mf`

This will write the Zip Code data to a folder, matching the [Miniflare KV](https://miniflare.dev/storage/kv) storage format, so that you can use this data locally.

```bash
zip-code-cloudflare-kv mf ZIPCODE_NAMESPACE ./data
```

Then from Miniflare you would use like normal, specifying the path where data is persisted:

```bash
miniflare --kv ZIPCODE_NAMESPACE --kv-persist ./data
```

The current folder structure for Miniflare KV will look like this:

```
data
  |- ZIPCODE_NAMESPACE
     |- <COUNTRY_CODE>
        |- i
           |- zip
              |- 90210 # => {"country":"US","code":"90210",...etc}
              |- 90210.meta.json # => {"key":"US:i:zip:90210"}
```

If you set a `--prefix` value, it would be one folder deeper:

```
data
  |- ZIPCODE_NAMESPACE
     |- <PREFIX>
        |- <COUNTRY_CODE>
           # etc...
```

## Keys

Data is written to KV to support several access patterns.

Most keys start with `<COUNTRY>:i:` or `<COUNTRY>:l:` where `i` is for `item` and `l` is for `list`. The items are intended to be retrieved using [KV `get`](https://developers.cloudflare.com/workers/runtime-apis/kv#reading-key-value-pairs), while the list items are an overloaded index approach, you would access them using [KV `list`](https://developers.cloudflare.com/workers/runtime-apis/kv#listing-keys) with the `prefix` option, and extract data from the keys themselves.

> **Note:** if you need specific access patterns, feel free to [open an issue](https://github.com/saibotsivad/zip-code-cloudflare-kv/issues) to discuss it!

#### Key: ZIP Lookup

```
<COUNTRY>:i:zip:<ZIP>
```

This will give you the detailed information for that ZIP Code. For example, the key `US:i:zip:08644` would give you:

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

#### Key: ???

*Still in progress.*

## Parameters

###### `<COUNTRY>`

Available country codes:

- `US` - United States

> **Note:** If you are interested in adding other countries, please [open an issue](https://github.com/saibotsivad/zip-code-cloudflare-kv/issues) to discuss it first.

###### `<STATE_CODE>`

The shortened code for the state, e.g. California is `CA`.

###### `<ZIP>`

The ZIP string is country-dependent.

- `US` - The 5-digit ZIP code numbers, e.g. `08644`.

## License

Data is generated using [nrviens/zipcodes](https://github.com/nrviens/zipcodes).

This code and documentation published and released under the [Very Open License](http://veryopenlicense.com).

If you need a commercial license, [contact me here](https://davistobias.com/license?software=zip-code-cloudflare-kv).
