import http from 'http'
import request from 'supertest'

import CachedHandler from '../src/handler'

type CHReturn = ReturnType<typeof CachedHandler> extends Promise<infer T> ? T : never

describe('slow handler', () => {
  let cached: CHReturn
  let server: http.Server

  beforeAll(async () => {
    const script = require.resolve('./mock')
    cached = await CachedHandler({ script }, { rules: [{ regex: '/slow-*', ttl: 0.5 }] })
    await cached.cache.del('payload:/slow-300')
    await cached.cache.del('payload:/slow-10100')
    server = new http.Server(cached.handler)
  })

  it('get /slow-300', done => {
    const tasks = [0, 1].map(
      i =>
        new Promise<number>(resolve => {
          request(server)
            .get('/slow-300')
            .end((err, res) => {
              console.log(i, 'ended')
              resolve(res.status)
            })
        }),
    )
    Promise.all(tasks).then(rv => {
      expect(rv).toEqual([200, 200])
    })
    setTimeout(done, 1000)
  })

  it('get /slow-300, stale state', done => {
    const tasks = [0, 1].map(
      i =>
        new Promise<number>(resolve => {
          request(server)
            .get('/slow-300')
            .end((_, res) => {
              console.log(i, 'ended')
              resolve(res.status)
            })
        }),
    )
    Promise.all(tasks).then(rv => {
      expect(rv).toEqual([200, 200])
      done()
    })
  })

  it('get /slow-10100', done => {
    const tasks = [0, 1].map(
      i =>
        new Promise<number>(resolve => {
          request(server)
            .get('/slow-10100')
            .end((_, res) => {
              console.log(i, 'ended')
              resolve(res.status)
            })
        }),
    )
    Promise.all(tasks).then(rv => {
      expect(rv).toEqual([200, 504])
      done()
    })
  }, 20000)

  afterAll(() => {
    server.close()
    cached.close()
  })
})
