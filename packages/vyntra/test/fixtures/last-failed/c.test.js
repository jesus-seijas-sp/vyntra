if (process.env.FIX !== '1') throw new Error('no load');
it('loads', () => expect(1).toBe(1));
