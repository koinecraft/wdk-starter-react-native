// Copyright 2024 Tether Operations Limited
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

type WalletListEntry = {
  identifier: string;
  exists: boolean;
};

/**
 * Resolve the wallet id to use for hooks like useWallet.
 * Only returns identifiers confirmed to exist in secure storage.
 */
const getCurrentWalletId = (
  activeWalletId: string | null,
  wallets: WalletListEntry[]
): string | undefined => {
  const existingWallets = wallets.filter(w => w.exists);

  if (activeWalletId && existingWallets.some(w => w.identifier === activeWalletId)) {
    return activeWalletId;
  }

  return existingWallets[0]?.identifier;
};

export default getCurrentWalletId;
