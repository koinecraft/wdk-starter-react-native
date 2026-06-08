import {
  AssetAddressMap,
  AssetTicker,
  NetworkType,
  WDKService,
} from '@tetherto/wdk-react-native-provider';

const ADDRESS_TIMEOUT_MS = 20_000;

function withTimeout<T>(promise: Promise<T>, label: string, ms = ADDRESS_TIMEOUT_MS): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    }),
  ]);
}

/**
 * WDK address resolution (especially ERC-4337 Safe addresses) can hang indefinitely
 * inside the Bare worklet when bundler/RPC HTTP calls never complete. This patch:
 * 1. Deduplicates network fetches (polygon/arbitrum reuse the ethereum address).
 * 2. Adds a per-network timeout so wallet import/create does not block forever.
 */
export function applyWdkServiceTimeoutPatch(): void {
  const service = WDKService as typeof WDKService & {
    getAssetAddress(network: string, index: number): Promise<{ address: string }>;
    resolveWalletAddresses(
      enabledAssets: AssetTicker[],
      index?: number
    ): Promise<Record<string, string | null>>;
  };

  const originalGetAssetAddress = service.getAssetAddress.bind(service);

  service.getAssetAddress = async (network: string, index: number) => {
    return withTimeout(
      originalGetAssetAddress(network, index),
      `getAssetAddress(${network}, ${index})`
    );
  };

  service.resolveWalletAddresses = async (enabledAssets, index = 0) => {
    const networkAddresses: Record<string, string | null> = {};
    const networksToFetch = new Set<NetworkType>();

    for (const asset of enabledAssets) {
      for (const networkType of Object.keys(AssetAddressMap[asset] ?? {}) as NetworkType[]) {
        networksToFetch.add(networkType);
      }
    }

    const results = await Promise.allSettled(
      [...networksToFetch].map(async networkType => {
        const result = await service.getAssetAddress(networkType, index);
        return { networkType, address: result.address };
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        networkAddresses[result.value.networkType] = result.value.address;
      } else {
        console.error('Error while resolving wallet address:', result.reason);
      }
    }

    if (networkAddresses[NetworkType.ETHEREUM]) {
      networkAddresses[NetworkType.POLYGON] = networkAddresses[NetworkType.ETHEREUM];
      networkAddresses[NetworkType.ARBITRUM] = networkAddresses[NetworkType.ETHEREUM];
    }

    return networkAddresses;
  };
}
