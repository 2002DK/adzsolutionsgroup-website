// ============================================================
//  Custom Cypress commands for the ADZ Bid Tracker dashboard
// ============================================================
//
// tracker.js ships with APPS_SCRIPT_URL = 'YOUR_APPS_SCRIPT_URL_HERE'
// (the real URL is only injected by GitHub Actions on deploy — see
// .github/workflows/deploy.yml). We deliberately never touch that
// placeholder for tests: fetch() treats it as a *relative* URL and
// resolves it against the current page, e.g.
//   /tracker/dashboard.html -> /tracker/YOUR_APPS_SCRIPT_URL_HERE
// which is a normal, interceptable request — no local edits to
// tracker.js and no risk of breaking the deploy sed injection.

const APPS_SCRIPT_GLOB = '**/YOUR_APPS_SCRIPT_URL_HERE';

// Seeds sessionStorage with a fake-but-well-formed session *before*
// dashboard.html's inline auth-gate script runs, so the Google OAuth
// screen is never involved in tests.
Cypress.Commands.add('visitDashboard', (options = {}) => {
  const user = {
    email: 'test.user@adzsolutionsgroup.com',
    name: 'Test User',
    picture: '',
    credential: 'fake-jwt-for-testing',
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...options.user,
  };

  return cy.visit('/tracker/dashboard.html', {
    ...options,
    onBeforeLoad(win) {
      win.sessionStorage.setItem('adz_user', JSON.stringify(user));
      if (options.onBeforeLoad) options.onBeforeLoad(win);
    },
  });
});

// Stubs every apiCall() the dashboard makes, keyed by the `action`
// field tracker.js sends in the POST body. Real Apps Script / Google
// Sheets are never touched. initApp() fires four requests on every
// page load (getBids, getScrapedBids, getSourcingSuppliers,
// getSourcingAssumptions) regardless of which tab is active — specs
// should `cy.wait(['@apiCall','@apiCall','@apiCall','@apiCall'])` to
// let all four settle before asserting on rendered state.
Cypress.Commands.add('mockApi', (overrides = {}) => {
  cy.fixture('bids.json').then((bidsFixture) => {
    cy.fixture('scrapedBids.json').then((scrapedFixture) => {
      cy.fixture('suppliers.json').then((suppliersFixture) => {
        cy.fixture('sourcingAssumptions.json').then((assumptionsFixture) => {
          cy.intercept('POST', APPS_SCRIPT_GLOB, (req) => {
            // tracker.js sends Content-Type: text/plain (to dodge a CORS
            // preflight against Apps Script), so Cypress won't auto-parse
            // the body as JSON — it arrives as a raw string here.
            const parsedBody = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
            const action = parsedBody && parsedBody.action;

            if (overrides[action]) {
              return req.reply(overrides[action]);
            }

            switch (action) {
              case 'getBids':
                return req.reply({ bids: bidsFixture });
              case 'getScrapedBids':
                return req.reply({ bids: scrapedFixture });
              case 'getSourcingSuppliers':
                return req.reply({ suppliers: suppliersFixture });
              case 'getSourcingAssumptions':
                return req.reply({ assumptions: assumptionsFixture });
              case 'addBid':
              case 'updateBid':
              case 'deleteBid':
              case 'addScrapedToTracker':
              case 'addSourcingSupplier':
              case 'updateSourcingSupplier':
              case 'deleteSourcingSupplier':
              case 'updateSourcingAssumptions':
                return req.reply({ success: true });
              default:
                return req.reply({ error: 'Unmocked action in test stub: ' + action });
            }
          }).as('apiCall');
        });
      });
    });
  });
});
