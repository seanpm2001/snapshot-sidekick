import { getAddress } from '@ethersproject/address';
import { splitSignature } from '@ethersproject/bytes';
import { Interface } from '@ethersproject/abi';
import { fetchSpace } from '../../helpers/snapshot';
import { signer, validateSpace } from './utils';
import abi from './deployAbi.json';

const DeployType = {
  Deploy: [
    { name: 'implementation', type: 'address' },
    { name: 'initializer', type: 'bytes' },
    { name: 'salt', type: 'uint256' }
  ]
};

export default async function payload(
  spaceOwner: string,
  id: string,
  maxSupply: number,
  mintPrice: string,
  proposerFee: number,
  salt: string,
  spaceTreasury: string
) {
  const space = await fetchSpace(id);
  await validateSpace(spaceOwner, space);

  const initializer = getInitializer(
    spaceOwner,
    space?.id as string,
    maxSupply,
    mintPrice,
    proposerFee,
    spaceTreasury
  );
  const implementationAddress = getAddress(
    process.env.NFT_CLAIMER_DEPLOY_IMPLEMENTATION_ADDRESS as string
  );

  return {
    initializer,
    implementation: implementationAddress,
    signature: await generateSignature(implementationAddress, initializer, salt)
  };
}

function getInitializer(
  spaceOwner: string,
  spaceId: string,
  maxSupply: number,
  mintPrice: string,
  proposerFee: number,
  spaceTreasury: string
) {
  const abiInterface = new Interface(abi);
  const params = [
    'TestDAO',
    '0.1',
    spaceId,
    maxSupply,
    BigInt(mintPrice),
    proposerFee,
    getAddress(spaceTreasury),
    getAddress(spaceOwner)
  ];

  const initializer = abiInterface.encodeFunctionData('initialize', params);

  return `${process.env.NFT_CLAIMER_DEPLOY_INITIALIZE_SELECTOR}${initializer.slice(10)}`;
}

async function generateSignature(implementation: string, initializer: string, salt: string) {
  const params = {
    domain: {
      name: 'SpaceCollectionFactory',
      version: '0.1',
      chainId: process.env.NFT_CLAIMER_NETWORK || '1',
      verifyingContract: process.env.NFT_CLAIMER_DEPLOY_VERIFYING_CONTRACT
    },
    types: DeployType,
    value: {
      implementation,
      initializer,
      salt: BigInt(salt)
    }
  };

  return splitSignature(await signer._signTypedData(params.domain, params.types, params.value));
}
