# Mock matchers

| Matcher | Passes when the mock |
| --- | --- |
| `toHaveBeenCalled()` | was called |
| `toHaveBeenCalledTimes(n)` | was called `n` times |
| `toHaveBeenCalledOnce()` | was called once |
| `toHaveBeenCalledWith(...args)` | was called at least once with these arguments |
| `toHaveBeenCalledExactlyOnceWith(...args)` | was called once, with these arguments |
| `toHaveBeenLastCalledWith(...args)` | was last called with these arguments |
| `toHaveBeenNthCalledWith(n, ...args)` | was called with these arguments the `n`th time |
| `toHaveReturned()`, `toHaveReturnedTimes(n)` | returned (without throwing), `n` times |
| `toHaveReturnedWith(value)` | returned `value` at least once |
| `toHaveLastReturnedWith(value)`, `toHaveNthReturnedWith(n, value)` | returned `value` the last / `n`th time |

Jest's older names work too: `toBeCalled`, `toBeCalledTimes`, `toBeCalledWith`, `lastCalledWith`, `nthCalledWith`, `toReturn`, `toReturnTimes`, `toReturnWith`, `lastReturnedWith`, `nthReturnedWith`.

## Chai assertions

`expect(value).to...` takes the Chai style Vitest supports, for tests written with it: `to.equal`, `to.eql` (and `deep.equal`), `to.be.true` / `false` / `null` / `undefined` / `NaN` / `ok` / `empty`, `to.exist`, `to.include` / `contain`, `to.be.a(type)`, `to.be.instanceOf`, `to.have.lengthOf`, `to.have.property(name, value?)`, `to.have.keys`, `to.have.members`, `to.be.above` / `below` / `least` / `most` / `within` / `closeTo`, `to.match`, `to.be.oneOf`, `to.throw`, and Sinon-Chai's `to.have.been.called` / `calledOnce` / `calledTimes(n)` / `calledWith(...)`. `not` negates, and the words in between (`be`, `been`, `is`, `that`, `and`, `have`, `with`...) read as in Chai.
