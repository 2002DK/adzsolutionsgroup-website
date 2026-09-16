describe('Sourcing tab', () => {
  beforeEach(() => {
    cy.mockApi();
    cy.visitDashboard();
    cy.wait(['@apiCall', '@apiCall', '@apiCall', '@apiCall']);
    cy.contains('.tab', 'Sourcing').click();
  });

  it('renders the assumptions bar with the current shared settings', () => {
    cy.get('#sourcingAssumptions input').eq(0).should('have.value', '15');    // referral fee %
    cy.get('#sourcingAssumptions input').eq(1).should('have.value', '0');     // other cost/unit
    cy.get('#sourcingAssumptions input').eq(3).should('have.value', '99.99');  // target price 1
    cy.get('#sourcingAssumptions input').eq(4).should('have.value', '109.99'); // target price 2
    cy.get('#sourcingAssumptions input').eq(5).should('have.value', '119.99'); // target price 3
  });

  it('lists suppliers sorted by margin, with landed cost and viability chips', () => {
    cy.get('#sourcingTableBody tr').should('have.length', 2);

    // Hebei Nanyang has real pricing — margin computed and "Solid" at
    // all three prices, sorted to the top; landed cost is flagged as
    // an FOB estimate since no DDP quote came back yet.
    cy.contains('#sourcingTableBody tr', 'Hebei Nanyang').within(() => {
      cy.contains('$41.00').should('exist');
      cy.contains('FOB est.').should('exist');
      cy.contains('Solid · 32.5%').should('exist');
      cy.contains('Solid · 37.3%').should('exist');
      cy.contains('Solid · 41.2%').should('exist');
    });

    // Second Supplier has no pricing yet — every margin column reads
    // "Need data" rather than a misleading number.
    cy.contains('#sourcingTableBody tr', 'Second Supplier').invoke('text').then((text) => {
      const matches = text.match(/Need data/g) || [];
      expect(matches).to.have.length(3);
    });
  });

  it('adds a new supplier through the modal', () => {
    cy.contains('button', '+ Add Supplier').click();
    cy.get('#supplierModalTitle').should('have.text', 'Add Supplier');
    cy.get('#sStatus').should('have.value', 'inquiry_sent');

    cy.get('#sName').type('Third Supplier Co');
    cy.get('#supplierSaveBtn').click();

    cy.wait('@apiCall').then((i) => expect(JSON.parse(i.request.body).action).to.eq('addSourcingSupplier'));
    cy.get('#sourcingTableBody tr').should('have.length', 3);
    cy.contains('#sourcingTableBody tr', 'Third Supplier Co').should('exist');
  });

  it('edits an existing supplier', () => {
    cy.contains('#sourcingTableBody tr', 'Hebei Nanyang')
      .contains('button', 'Edit')
      .click();

    cy.get('#supplierModalTitle').should('have.text', 'Edit Supplier');
    cy.get('#sName').should('have.value', 'Hebei Nanyang');
    cy.get('#sStatus').should('have.value', 'quote_received');
    cy.get('#sUnit300').should('have.value', '32');

    cy.get('#sStatus').select('selected');
    cy.get('#supplierSaveBtn').click();

    cy.wait('@apiCall').then((i) => expect(JSON.parse(i.request.body).action).to.eq('updateSourcingSupplier'));
    cy.contains('#sourcingTableBody tr', 'Hebei Nanyang').should('contain.text', 'Selected');
  });

  it('deletes a supplier after confirmation', () => {
    cy.on('window:confirm', () => true);

    cy.contains('#sourcingTableBody tr', 'Second Supplier')
      .contains('button', '✕')
      .click();

    cy.wait('@apiCall').then((i) => expect(JSON.parse(i.request.body).action).to.eq('deleteSourcingSupplier'));
    cy.contains('#sourcingTableBody tr', 'Second Supplier').should('not.exist');
    cy.get('#sourcingTableBody tr').should('have.length', 1);
  });

  it('recomputes margins live when an assumption changes', () => {
    // Raising the referral fee should pull Hebei Nanyang's margin down.
    cy.get('#sourcingAssumptions input').eq(0).clear().type('25').blur();

    cy.wait('@apiCall').then((i) => {
      const body = JSON.parse(i.request.body);
      expect(body.action).to.eq('updateSourcingAssumptions');
      expect(body.assumptions.referralFeePct).to.eq(25);
    });

    cy.contains('#sourcingTableBody tr', 'Hebei Nanyang').within(() => {
      cy.contains('Solid · 32.5%').should('not.exist');
    });
  });
});
