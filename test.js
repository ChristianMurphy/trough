import test from 'tape'
import {trough} from './index.js'

test('trough()', function (t) {
  t.equal(typeof trough, 'function', 'should be a function')
  t.equal(typeof trough(), 'object', 'should return an object')

  t.end()
})

test('use()', function (t) {
  var p = trough()

  t.throws(
    function () {
      p.use()
    },
    /Expected `fn` to be a function, not undefined/,
    'should throw without `fn`'
  )

  p = trough()

  t.equal(p.use(Function.prototype), p, 'should return self')

  t.end()
})

test('synchronous middleware', function (t) {
  var value = new Error('Foo')

  t.plan(9)

  trough()
    .use(function () {
      return value
    })
    .run(function (error) {
      t.equal(error, value, 'should pass returned errors to `done`')
    })

  trough()
    .use(function () {
      throw value
    })
    .run(function (error) {
      t.equal(error, value, 'should pass thrown errors to `done`')
    })

  trough()
    .use(function (value) {
      t.equal(value, 'some', 'should pass values to `fn`s')
    })
    .run('some', function (error, value) {
      t.ifErr(error)
      t.equal(value, 'some', 'should pass values to `done`')
    })

  trough()
    .use(function (value) {
      t.equal(value, 'some', 'should pass values to `fn`s')
      return value + 'thing'
    })
    .use(function (value) {
      t.equal(value, 'something', 'should modify values')
      return value + ' more'
    })
    .run('some', function (error, value) {
      t.ifErr(error)
      t.equal(value, 'something more', 'should pass modified values to `done`')
    })
})

test('promise middleware', function (t) {
  var value = new Error('Foo')

  t.plan(8)

  trough()
    .use(function () {
      return new Promise(function (resolve, reject) {
        reject(value)
      })
    })
    .run(function (error) {
      t.equal(error, value, 'should pass rejected errors to `done`')
    })

  trough()
    .use(function (value) {
      t.equal(value, 'some', 'should pass values to `fn`s')

      return new Promise(function (resolve) {
        resolve()
      })
    })
    .run('some', function (error, value) {
      t.ifErr(error)
      t.equal(value, 'some', 'should pass values to `done`')
    })

  trough()
    .use(function (value) {
      t.equal(value, 'some', 'should pass values to `fn`s')

      return new Promise(function (resolve) {
        resolve(value + 'thing')
      })
    })
    .use(function (value) {
      t.equal(value, 'something', 'should modify values')

      return new Promise(function (resolve) {
        resolve(value + ' more')
      })
    })
    .run('some', function (error, value) {
      t.ifErr(error)
      t.equal(value, 'something more', 'should pass modified values to `done`')
    })
})

test('asynchronous middleware', function (t) {
  var value = new Error('Foo')

  t.plan(11)

  trough()
    .use(function (next) {
      next(value)
    })
    .run(function (error) {
      t.equal(error, value, 'should pass given errors to `done`')
    })

  trough()
    .use(function (next) {
      setImmediate(function () {
        next(value)
      })
    })
    .run(function (error) {
      t.equal(error, value, 'should pass async given errors to `done`')
    })

  trough()
    .use(function (next) {
      next(value)
      next(new Error('Other'))
    })
    .run(function (error) {
      t.equal(error, value, 'should ignore multiple sync `next` calls')
    })

  trough()
    .use(function (next) {
      setImmediate(function () {
        next(value)
        setImmediate(function () {
          next(new Error('Other'))
        })
      })
    })
    .run(function (error) {
      t.equal(error, value, 'should ignore multiple async `next` calls')
    })

  trough()
    .use(function (value, next) {
      t.equal(value, 'some', 'should pass values to `fn`s')
      setImmediate(next)
    })
    .run('some', function (error, value) {
      t.ifErr(error)
      t.equal(value, 'some', 'should pass values to `done`')
    })

  trough()
    .use(function (value, next) {
      t.equal(value, 'some', 'should pass values to `fn`s')

      setImmediate(function () {
        next(null, value + 'thing')
      })
    })
    .use(function (value, next) {
      t.equal(value, 'something', 'should modify values')

      setImmediate(function () {
        next(null, value + ' more')
      })
    })
    .run('some', function (error, value) {
      t.ifErr(error)
      t.equal(value, 'something more', 'should pass modified values to `done`')
    })
})

test('run()', function (t) {
  t.plan(13)

  t.throws(
    function () {
      trough().run()
    },
    /^TypeError: Expected function as last argument, not undefined$/,
    'should throw if `done` is not a function'
  )

  trough()
    .use(function (value) {
      t.equal(value, 'some', 'input')

      return value + 'thing'
    })
    .use(function (value) {
      t.equal(value, 'something', 'sync')

      return new Promise(function (resolve) {
        resolve(value + ' more')
      })
    })
    .use(function (value, next) {
      t.equal(value, 'something more', 'promise')

      setImmediate(function () {
        next(null, value + '.')
      })
    })
    .run('some', function (error, value) {
      t.ifErr(error)
      t.equal(value, 'something more.', 'async')
    })

  t.test('should throw errors thrown from `done` (#1)', function (st) {
    st.plan(1)

    st.throws(function () {
      trough().run(function () {
        throw new Error('alpha')
      })
    }, /^Error: alpha$/)
  })

  t.test('should throw errors thrown from `done` (#2)', function (st) {
    st.plan(1)

    process.once('uncaughtException', function (error) {
      st.equal(String(error), 'Error: bravo')
    })

    trough()
      .use(function (next) {
        setImmediate(next)
      })
      .run(function () {
        throw new Error('bravo')
      })
  })

  t.test('should rethrow errors thrown from `done` (#1)', function (st) {
    st.plan(1)

    process.once('uncaughtException', function (error) {
      st.equal(String(error), 'Error: bravo')
    })

    trough()
      .use(function (next) {
        setImmediate(function () {
          next(new Error('bravo'))
        })
      })
      .run(function (error) {
        throw error
      })
  })

  t.test('should rethrow errors thrown from `done` (#2)', function (st) {
    st.plan(1)

    process.once('uncaughtException', function (error) {
      st.equal(String(error), 'Error: bravo')
    })

    trough()
      .use(function () {
        throw new Error('bravo')
      })
      .run(function (error) {
        throw error
      })
  })

  t.test('should not swallow uncaught exceptions (#1)', function (st) {
    st.plan(1)

    process.once('uncaughtException', function (error) {
      st.equal(String(error), 'Error: charlie')
    })

    trough()
      .use(function (next) {
        setImmediate(next)
      })
      .run(function () {
        setImmediate(function () {
          throw new Error('charlie')
        })
      })
  })

  t.test('should not swallow uncaught exceptions (#2)', function (st) {
    st.plan(1)

    process.once('uncaughtException', function (error) {
      st.equal(String(error), 'Error: charlie')
    })

    trough()
      .use(function (next) {
        setImmediate(function () {
          next(new Error('charlie'))
        })
      })
      .run(function (error) {
        setImmediate(function () {
          throw error
        })
      })
  })

  t.test('should not swallow errors in the `done` handler', function (st) {
    var value = new Error('hotel')

    st.plan(1)

    process.once('uncaughtException', function (error) {
      st.equal(error, value, 'should pass the error')
    })

    trough()
      .use(function (next) {
        next(value)
      })
      .run(function (error) {
        throw error
      })
  })
})
