import test from 'node:test';
import assert from 'node:assert/strict';
import { lanAddresses, isLoopbackOnly } from '../src/net.js';

const iface = (address, extra = {}) => ({ address, family: 'IPv4', internal: false, ...extra });

test('lista so IPv4 externos, sem loopback nem link-local', () => {
  const list = lanAddresses({
    lo: [iface('127.0.0.1', { internal: true })],
    Wi: [iface('192.168.0.10'), { address: 'fe80::1', family: 'IPv6', internal: false }],
    Eth: [iface('169.254.7.7')],
  });
  assert.deepEqual(list, [{ name: 'Wi', address: '192.168.0.10', virtual: false }]);
});

test('redes privadas comuns vem primeiro', () => {
  const list = lanAddresses({ a: [iface('203.0.113.5')], b: [iface('172.20.1.2')], c: [iface('10.0.0.4')], d: [iface('192.168.1.9')] });
  assert.deepEqual(list.map(x => x.address), ['192.168.1.9', '10.0.0.4', '172.20.1.2', '203.0.113.5']);
});

test('sem rede, lista vazia (nao quebra)', () => {
  assert.deepEqual(lanAddresses({}), []);
  assert.deepEqual(lanAddresses({ x: undefined }), []);
});

test('isLoopbackOnly', () => {
  assert.ok(isLoopbackOnly('127.0.0.1'));
  assert.ok(isLoopbackOnly('localhost'));
  assert.ok(!isLoopbackOnly('0.0.0.0'));
  assert.ok(!isLoopbackOnly('192.168.0.10'));
});

test('adaptadores virtuais (Hyper-V, WSL, Docker) vem marcados e por ultimo', () => {
  const list = lanAddresses({
    'vEthernet (WSL)': [iface('172.21.128.1')], Ethernet: [iface('192.168.1.6')], 'vEthernet (Default Switch)': [iface('172.27.208.1')],
  });
  assert.deepEqual(list.map(x => [x.address, x.virtual]), [['192.168.1.6', false], ['172.21.128.1', true], ['172.27.208.1', true]]);
});
