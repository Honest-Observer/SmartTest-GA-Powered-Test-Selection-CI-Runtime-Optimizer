beforeAll(() => {
  if (global.__coverage__) {
    for (const file of Object.keys(global.__coverage__)) {
      const cov = global.__coverage__[file];
      if (cov.s) for (const key of Object.keys(cov.s)) cov.s[key] = 0;
      if (cov.f) for (const key of Object.keys(cov.f)) cov.f[key] = 0;
      if (cov.b) {
        for (const key of Object.keys(cov.b)) {
          if (Array.isArray(cov.b[key])) {
            for (let i = 0; i < cov.b[key].length; i++) {
              cov.b[key][i] = 0;
            }
          }
        }
      }
    }
  }
});
