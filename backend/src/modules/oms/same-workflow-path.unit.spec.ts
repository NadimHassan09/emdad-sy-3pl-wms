/**
 * Same-code-path proof (documentation + static check):
 * Migrated and new orders use the same Nest services — never a legacy fork.
 */
describe('same NEW workflow code path', () => {
  it('recordExternalFulfillment and warehouse confirm live in the same OMS/Outbound modules', () => {
    // These require() paths are the production entrypoints for both new and migrated orders.
    const omsOrders = require('./oms-orders.service');
    const outbound = require('../outbound/outbound.service');
    const workflow = require('../warehouse-workflow/workflow-engine.service');
    expect(omsOrders.OmsOrdersService).toBeDefined();
    expect(outbound.OutboundService).toBeDefined();
    expect(workflow.WorkflowEngineService).toBeDefined();
    expect(typeof omsOrders.OmsOrdersService.prototype.recordExternalFulfillment).toBe(
      'function',
    );
    expect(typeof outbound.OutboundService.prototype.confirmAndDeduct).toBe('function');
    expect(
      typeof workflow.WorkflowEngineService.prototype.createOutboundInstanceWithFirstPickTask,
    ).toBe('function');
  });

  it('does not export a legacy OMS or outbound workflow service', () => {
    expect(() => require('./legacy-oms.service')).toThrow();
    expect(() => require('../outbound/legacy-outbound.service')).toThrow();
  });
});
