import os from 'node:os';

// adaptadores de maquina virtual / container: o tablet nunca alcanca por eles
const VIRTUAL = /vEthernet|WSL|Hyper-V|Default Switch|VirtualBox|VMware|vmnet|Docker|docker|veth|^br-|virbr/;

/**
 * Enderecos IPv4 desta maquina na rede local (para digitar no tablet).
 * Ignora loopback e enderecos de link-local (169.254.x.x). `ifaces` so existe para testar.
 */
export function lanAddresses(ifaces = os.networkInterfaces()) {
  const out = [];
  for (const [name, list] of Object.entries(ifaces)) {
    for (const i of list || []) {
      if (i.family !== 'IPv4' || i.internal || i.address.startsWith('169.254.')) continue;
      out.push({ name, address: i.address, virtual: VIRTUAL.test(name) });
    }
  }
  // reais antes das virtuais; depois as redes privadas comuns (192.168 / 10 / 172.16-31)
  const rank = a => (/^192\.168\./.test(a) ? 0 : /^10\./.test(a) ? 1 : /^172\.(1[6-9]|2\d|3[01])\./.test(a) ? 2 : 3);
  return out.sort((a, b) => Number(a.virtual) - Number(b.virtual) || rank(a.address) - rank(b.address));
}

/** Escuta so nesta maquina? (para avisar o usuario do que esta exposto) */
export const isLoopbackOnly = host => host === '127.0.0.1' || host === 'localhost' || host === '::1';
