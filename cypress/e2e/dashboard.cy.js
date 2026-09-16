describe('Bid Tracker Dashboard', () => {
  beforeEach(() => {
    cy.mockApi();
    cy.visitDashboard();
    // initApp() fires getBids, getScrapedBids, getSourcingSuppliers, and
    // getSourcingAssumptions concurrently on every load, regardless of
    // which tab is active — wait for all four before asserting.
    cy.wait(['@apiCall', '@apiCall', '@apiCall', '@apiCall']);
  });

  it('renders stats computed from the seeded bids', () => {
    // Status breakdown is a direct count per status, so this is
    // stable regardless of "today" — no date-derived stats anymore.
    cy.get('.stat-card').eq(0).find('.stat-value').should('have.text', '3'); // Total Bids
    cy.get('.stat-card').eq(1).find('.stat-value').should('have.text', '1'); // Drafting
    cy.get('.stat-card').eq(2).find('.stat-value').should('have.text', '1'); // Submitted
    cy.get('.stat-card').eq(3).find('.stat-value').should('have.text', '1'); // Won
    cy.get('.stat-card').eq(4).find('.stat-value').should('have.text', '0'); // Lost
  });

  it('lists the seeded bids in the table', () => {
    cy.get('#bidTableBody tr').should('have.length', 3);
    cy.contains('#bidTableBody tr', 'IT Support Services RFP').should('exist');
    cy.contains('#bidTableBody tr', 'Healthcare Consulting Services').should('exist');
    cy.contains('#bidTableBody tr', 'Web Development — County Portal Refresh').should('exist');
  });

  it('adds a new bid through the modal', () => {
    cy.contains('button', '+ Add Bid').click();
    cy.get('#modalTitle').should('have.text', 'Add New Bid');
    cy.get('#fStatus').should('have.value', 'drafting'); // default status

    cy.get('#fTitle').type('Cybersecurity Assessment RFP');
    cy.get('#fCounty').select('Mercer');
    cy.get('#fCategory').select('IT Services');

    cy.get('#saveBtn').click();
    cy.wait('@apiCall').then((i) => expect(JSON.parse(i.request.body).action).to.eq('addBid'));

    cy.get('#bidTableBody tr').should('have.length', 4);
    cy.contains('#bidTableBody tr', 'Cybersecurity Assessment RFP').should('exist');
  });

  it('edits an existing bid', () => {
    cy.contains('#bidTableBody tr', 'IT Support Services RFP')
      .contains('button', 'Edit')
      .click();

    cy.get('#modalTitle').should('have.text', 'Edit Bid');
    cy.get('#fTitle').should('have.value', 'IT Support Services RFP');
    cy.get('#fStatus').should('have.value', 'drafting');

    cy.get('#fTitle').clear().type('IT Support Services RFP (Updated)');
    cy.get('#fStatus').select('submitted');
    cy.get('#saveBtn').click();
    cy.wait('@apiCall').then((i) => expect(JSON.parse(i.request.body).action).to.eq('updateBid'));

    cy.contains('#bidTableBody tr', 'IT Support Services RFP (Updated)')
      .should('contain.text', 'Submitted');
  });

  it('deletes a bid after confirmation', () => {
    cy.on('window:confirm', () => true);

    cy.contains('#bidTableBody tr', 'Healthcare Consulting Services')
      .contains('button', '✕')
      .click();

    cy.wait('@apiCall').then((i) => expect(JSON.parse(i.request.body).action).to.eq('deleteBid'));
    cy.contains('#bidTableBody tr', 'Healthcare Consulting Services').should('not.exist');
    cy.get('#bidTableBody tr').should('have.length', 2);
  });

  it('filters the table by county', () => {
    cy.get('#filterCounty').select('Essex');
    cy.get('#bidTableBody tr').should('have.length', 1);
    cy.contains('#bidTableBody tr', 'Web Development — County Portal Refresh').should('exist');
  });

  it('filters the table by status', () => {
    cy.get('#filterStatus').select('won');
    cy.get('#bidTableBody tr').should('have.length', 1);
    cy.contains('#bidTableBody tr', 'Web Development — County Portal Refresh').should('exist');
  });

  it('searches across title, county, and bid number', () => {
    cy.get('#searchInput').type('Burlington');
    cy.get('#bidTableBody tr').should('have.length', 1);
    cy.contains('#bidTableBody tr', 'Healthcare Consulting Services').should('exist');

    cy.get('#searchInput').clear().type('RFP-26-0011');
    cy.get('#bidTableBody tr').should('have.length', 1);
    cy.contains('#bidTableBody tr', 'IT Support Services RFP').should('exist');
  });

  it('shows scraped opportunities in the County Directory and tracks one', () => {
    cy.contains('.tab', 'County Directory').click();

    cy.contains('.county-card', 'Camden County').within(() => {
      cy.contains('IT Support Services RFP').parents('.county-bid-item').should('contain.text', '✓ Added');
      cy.contains('Marketing & Outreach Services').parents('.county-bid-item').contains('button', '+ Track').click();
    });

    cy.wait('@apiCall').then((i) => expect(JSON.parse(i.request.body).action).to.eq('addScrapedToTracker'));
    cy.wait('@apiCall'); // refetch getBids
    cy.wait('@apiCall'); // refetch getScrapedBids
  });
});
