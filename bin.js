#!/usr/bin/env node

import { readFileSync } from 'node:fs'

import { put } from 'httpie'
import sade from 'sade'
import split from 'just-split'

const getAllZipData = async ({ prefix }) => ([
	{
		key: (prefix || '') + 'My-Key',
		value: 'Some string',
	},
])

const log = (message, ...parts) => console.log(`[${new Date().toISOString()}] ${message}`, ...parts)

const putValues = async ({ accountId, namespaceId, prefix }) => {
	if (!accountId) accountId = process.env.CF_ACCOUNT_ID
	if (!accountId || !namespaceId) {
		log('Must set an account id and KV namespace id.')
		process.exit(1)
	}
	const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/bulk`
	const data = await getAllZipData({ prefix })
	const chunks = split(data, 123)
	let currentChunk = 0
	for (const body of chunks) {
		log(`Writing chunk ${++currentChunk} of ${chunks.length}`)
		let response
		try {
			response = await put(url, {
				body,
				headers: {
					'X-Auth-Key': 'TODO', // TODO
				},
			})
		} catch (error) {
			response = error
		}
		if (!response.data?.success) {
			log('Failed to write chunk to KV.', JSON.stringify(response.data, undefined, 4))
		}
	}
}

sade('zip-code-cloudflare-kv', true)
	.version(JSON.parse(readFileSync('./package.json', 'utf8')).version)
	.describe('Fill a Cloudflare KV namespace with ZIP Code details.')
	.option('-a, --accountId', 'Your Cloudflare account id. Overrides the default environment variable "CF_ACCOUNT_ID".')
	.option('-n, --namespaceId', 'The KV namespace identifier to fill with data.')
	.option('-p, --prefix', 'Add an additional prefix to all items, e.g. for a shared KV namespace.')
	.action(props => putValues(props).catch(error => {
		console.error('An error occurred while pushing data to KV.', error)
		process.exit(1)
	}).then(() => process.exit(0)))
	.parse(process.argv)
