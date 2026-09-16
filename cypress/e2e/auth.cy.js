describe('Dashboard auth gate', () => {
  it('redirects to login when there is no session', () => {
    cy.visit('/tracker/dashboard.html');
    cy.url().should('include', '/tracker/login.html');
  });

  it('redirects to login when the session is expired', () => {
    cy.visit('/tracker/dashboard.html', {
      onBeforeLoad(win) {
        win.sessionStorage.setItem('adz_user', JSON.stringify({
          email: 'test.user@adzsolutionsgroup.com',
          name: 'Test User',
          credential: 'fake-jwt-for-testing',
          exp: Math.floor(Date.now() / 1000) - 60, // already expired
        }));
      },
    });
    cy.url().should('include', '/tracker/login.html');
  });

  it('loads the dashboard with a valid seeded session, no Google sign-in involved', () => {
    cy.mockApi();
    cy.visitDashboard();
    cy.wait('@apiCall');
    cy.url().should('include', '/tracker/dashboard.html');
    cy.get('#userEmail').should('contain.text', 'Test User');
  });
});
