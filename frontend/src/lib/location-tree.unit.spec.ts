import { describe, expect, it } from 'vitest';
import type { Location, LocationTreeNode } from '../api/locations';

function buildLocationTree(locations: Location[]): {
  roots: LocationTreeNode[];
  resolve: (id: string) => Location | undefined;
} {
  const map = new Map<string, Location>();
  const nodeMap = new Map<string, LocationTreeNode>();

  for (const loc of locations) {
    map.set(loc.id, loc);
    nodeMap.set(loc.id, {
      id: loc.id,
      name: loc.name,
      fullPath: loc.fullPath,
      type: loc.type,
      barcode: loc.barcode,
      children: [],
    });
  }

  const roots: LocationTreeNode[] = [];
  for (const loc of locations) {
    const node = nodeMap.get(loc.id)!;
    if (loc.parentId && nodeMap.has(loc.parentId)) {
      nodeMap.get(loc.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return {
    roots,
    resolve: (id: string) => map.get(id),
  };
}

describe('Location Tree Builder & Hierarchy', () => {
  const wh1Id = 'wh-001-uuid';

  it('builds a hierarchical tree from flat locations with roots and nested children', () => {
    const flatLocations: Location[] = [
      {
        id: 'loc-1',
        warehouseId: wh1Id,
        parentId: null,
        name: 'Aisle A',
        fullPath: 'WH-001/A',
        type: 'iss',
        barcode: 'WH-001-A',
        status: 'active',
      },
      {
        id: 'loc-2',
        warehouseId: wh1Id,
        parentId: 'loc-1',
        name: 'Shelf 1',
        fullPath: 'WH-001/A/1',
        type: 'internal',
        barcode: 'WH-001-A-1',
        status: 'active',
      },
      {
        id: 'loc-3',
        warehouseId: wh1Id,
        parentId: 'loc-2',
        name: 'Bin 01',
        fullPath: 'WH-001/A/1/01',
        type: 'internal',
        barcode: 'WH-001-A-1-01',
        status: 'active',
      },
      {
        id: 'loc-4',
        warehouseId: wh1Id,
        parentId: null,
        name: 'Receiving Dock',
        fullPath: 'WH-001/RECEIVING',
        type: 'input',
        barcode: 'WH-001-REC',
        status: 'active',
      },
    ];

    const { roots, resolve } = buildLocationTree(flatLocations);

    // Two roots: Aisle A and Receiving Dock
    expect(roots.length).toBe(2);
    expect(roots[0].name).toBe('Aisle A');
    expect(roots[1].name).toBe('Receiving Dock');

    // Aisle A has 1 child: Shelf 1
    expect(roots[0].children.length).toBe(1);
    expect(roots[0].children[0].name).toBe('Shelf 1');

    // Shelf 1 has 1 child: Bin 01
    expect(roots[0].children[0].children.length).toBe(1);
    expect(roots[0].children[0].children[0].name).toBe('Bin 01');

    // Resolution function returns full original location
    const resolved = resolve('loc-3');
    expect(resolved).toBeDefined();
    expect(resolved?.fullPath).toBe('WH-001/A/1/01');
    expect(resolved?.type).toBe('internal');
  });

  it('handles empty locations array gracefully', () => {
    const { roots, resolve } = buildLocationTree([]);
    expect(roots).toEqual([]);
    expect(resolve('any-id')).toBeUndefined();
  });
});
