const test = require('ava')
const {HomebaseConfig} = require('../lib/config')
const {createServer} = require('./util')

test('login fails on wrong username or password', async t => {
  var res
  var server = createServer(`
webapi:
  username: bob
  password: hunter2
`)

  // wrong password fails
  res = await server.req.post({
    uri: '/v1/accounts/login',
    json: {
      username: 'bob',
      password: 'hunter3'
    }
  })
  t.deepEqual(res.statusCode, 403)

  // wrong username fails
  res = await server.req.post({
    uri: '/v1/accounts/login',
    json: {
      username: 'alice',
      password: 'hunter2'
    }
  })
  t.deepEqual(res.statusCode, 403)

  server.close()
})

test('can get account info only if logged in', async t => {
  var res
  var auth
  var server = createServer(`
webapi:
  username: bob
  password: hunter2
dats:
  - url: dat://1f968afe867f06b0d344c11efc23591c7f8c5fb3b4ac938d6000f330f6ee2a03/
    domain: mysite.test.com
`)

  // cant get account info if not logged in
  res = await server.req.get({
    uri: '/v1/accounts/account'
  })
  t.deepEqual(res.statusCode, 401)

  // cant list dats if not logged in
  res = await server.req.get({
    uri: '/v1/dats'
  })
  t.deepEqual(res.statusCode, 401)

  // login
  res = await server.req.post({
    uri: '/v1/accounts/login',
    json: {
      username: 'bob',
      password: 'hunter2'
    }
  })
  t.deepEqual(res.statusCode, 200)
  auth = {bearer: res.body.sessionToken}

  // can get account info
  res = await server.req.get({
    uri: '/v1/accounts/account',
    auth,
    json: true
  })
  t.deepEqual(res.statusCode, 200)
  t.deepEqual(res.body.username, 'bob')
  t.not(res.body.diskQuota, undefined)
  t.not(res.body.diskUsed, undefined)

  // can list dats
  res = await server.req.get({
    uri: '/v1/dats',
    auth,
    json: true
  })
  t.deepEqual(res.statusCode, 200)
  t.deepEqual(res.body.items, [
    {
      url: 'dat://1f968afe867f06b0d344c11efc23591c7f8c5fb3b4ac938d6000f330f6ee2a03/',
      additionalUrls: [
        'dat://mysite.test.com'
      ]
    }
  ])

  // logout
  res = await server.req.post({
    uri: '/v1/accounts/logout',
    auth
  })
  t.deepEqual(res.statusCode, 200)

  // cant get account info on ended session
  res = await server.req.get({
    uri: '/v1/accounts/account',
    auth
  })
  t.deepEqual(res.statusCode, 401)

  server.close()
})

test('add & remove dats', async t => {
  var res
  var auth
  var syncPromise
  var server = createServer(`
webapi:
  username: bob
  password: hunter2
dats:
  - url: dat://1f968afe867f06b0d344c11efc23591c7f8c5fb3b4ac938d6000f330f6ee2a03/
    domain: mysite.test.com
`)

  // login
  res = await server.req.post({
    uri: '/v1/accounts/login',
    json: {
      username: 'bob',
      password: 'hunter2'
    }
  })
  t.deepEqual(res.statusCode, 200)
  auth = {bearer: res.body.sessionToken}

  // add dat
  syncPromise = new Promise(resolve => server.config.events.once('read-config', resolve))
  res = await server.req.post({
    uri: '/v1/dats/add',
    json: {
      url: 'dat://868d6000f330f6967f06b3ee2a03811efc23591afe0d344cc7f8c5fb3b4ac91f/',
      domains: ['othersite.com']
    },
    auth
  })
  t.deepEqual(res.statusCode, 200)

  // wait for sync
  await syncPromise

  // get dat (verify)
  res = await server.req.get({
    uri: '/v1/dats/item/868d6000f330f6967f06b3ee2a03811efc23591afe0d344cc7f8c5fb3b4ac91f',
    auth,
    json: true
  })
  t.deepEqual(res.statusCode, 200)
  t.deepEqual(res.body, {
    url: 'dat://868d6000f330f6967f06b3ee2a03811efc23591afe0d344cc7f8c5fb3b4ac91f/',
    additionalUrls: [
      'dat://othersite.com'
    ]
  })

  // check config
  t.deepEqual(
    (new HomebaseConfig(server.config.configPath)).canonical.dats,
    [
      {
        url: 'dat://1f968afe867f06b0d344c11efc23591c7f8c5fb3b4ac938d6000f330f6ee2a03/',
        domains: [
          'mysite.test.com'
        ]
      },
      {
        url: 'dat://868d6000f330f6967f06b3ee2a03811efc23591afe0d344cc7f8c5fb3b4ac91f/',
        domains: [
          'othersite.com'
        ]
      }
    ]
  )

  // wait 500ms for config-update-watch to reset
  await new Promise(resolve => setTimeout(resolve, 500))

  // partially update dat
  syncPromise = new Promise(resolve => server.config.events.once('read-config', resolve))
  res = await server.req.post({
    uri: '/v1/dats/item/868d6000f330f6967f06b3ee2a03811efc23591afe0d344cc7f8c5fb3b4ac91f',
    json: {
      domains: ['othersite.com', 'other-site.com']
    },
    auth
  })
  t.deepEqual(res.statusCode, 200)

  // wait for sync
  console.log('waiting for sync')
  await syncPromise

  // get dat (verify)
  res = await server.req.get({
    uri: '/v1/dats/item/868d6000f330f6967f06b3ee2a03811efc23591afe0d344cc7f8c5fb3b4ac91f',
    auth,
    json: true
  })
  t.deepEqual(res.statusCode, 200)
  t.deepEqual(res.body, {
    url: 'dat://868d6000f330f6967f06b3ee2a03811efc23591afe0d344cc7f8c5fb3b4ac91f/',
    additionalUrls: [
      'dat://othersite.com',
      'dat://other-site.com'
    ]
  })

  // check config
  t.deepEqual(
    (new HomebaseConfig(server.config.configPath)).canonical.dats,
    [
      {
        url: 'dat://1f968afe867f06b0d344c11efc23591c7f8c5fb3b4ac938d6000f330f6ee2a03/',
        domains: [
          'mysite.test.com'
        ]
      },
      {
        url: 'dat://868d6000f330f6967f06b3ee2a03811efc23591afe0d344cc7f8c5fb3b4ac91f/',
        domains: [
          'othersite.com',
          'other-site.com'
        ]
      }
    ]
  )

  // list dats
  res = await server.req.get({
    uri: '/v1/dats',
    auth,
    json: true
  })
  t.deepEqual(res.statusCode, 200)
  t.deepEqual(res.body.items, [
    {
      url: 'dat://1f968afe867f06b0d344c11efc23591c7f8c5fb3b4ac938d6000f330f6ee2a03/',
      additionalUrls: [
        'dat://mysite.test.com'
      ]
    },
    {
      url: 'dat://868d6000f330f6967f06b3ee2a03811efc23591afe0d344cc7f8c5fb3b4ac91f/',
      additionalUrls: [
        'dat://othersite.com',
        'dat://other-site.com'
      ]
    }
  ])

  // wait 500ms for config-update-watch to reset
  await new Promise(resolve => setTimeout(resolve, 500))

  // remove dat
  syncPromise = new Promise(resolve => server.config.events.once('read-config', resolve))
  res = await server.req.post({
    uri: '/v1/dats/remove',
    json: {
      url: '868d6000f330f6967f06b3ee2a03811efc23591afe0d344cc7f8c5fb3b4ac91f'
    },
    auth
  })
  t.deepEqual(res.statusCode, 200)

  // wait for sync
  await syncPromise

  // check config
  t.deepEqual(
    (new HomebaseConfig(server.config.configPath)).canonical.dats,
    [
      {
        url: 'dat://1f968afe867f06b0d344c11efc23591c7f8c5fb3b4ac938d6000f330f6ee2a03/',
        domains: [
          'mysite.test.com'
        ]
      }
    ]
  )

  // list dats
  res = await server.req.get({
    uri: '/v1/dats',
    auth,
    json: true
  })
  t.deepEqual(res.statusCode, 200)
  t.deepEqual(res.body.items, [
    {
      url: 'dat://1f968afe867f06b0d344c11efc23591c7f8c5fb3b4ac938d6000f330f6ee2a03/',
      additionalUrls: [
        'dat://mysite.test.com'
      ]
    }
  ])

  server.close()
})
