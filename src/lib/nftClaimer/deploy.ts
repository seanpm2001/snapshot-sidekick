import { getAddress } from '@ethersproject/address';
import { splitSignature } from '@ethersproject/bytes';
import { FormatTypes, Interface } from '@ethersproject/abi';
import { fetchSpace } from '../../helpers/snapshot';
import { signer, validateAddresses, validateSpace } from './utils';
import spaceCollectionAbi from './spaceCollectionImplementationAbi.json';
import spaceFactoryAbi from './spaceFactoryAbi.json';

const DeployType = {
  Deploy: [
    { name: 'implementation', type: 'address' },
    { name: 'initializer', type: 'bytes' },
    { name: 'salt', type: 'uint256' }
  ]
};

const VERIFYING_CONTRACT = getAddress(process.env.NFT_CLAIMER_DEPLOY_VERIFYING_CONTRACT as string);
const IMPLEMENTATION_ADDRESS = getAddress(
  process.env.NFT_CLAIMER_DEPLOY_IMPLEMENTATION_ADDRESS as string
);
const NFT_CLAIMER_NETWORK = process.env.NFT_CLAIMER_NETWORK;
const INITIALIZE_SELECTOR = process.env.NFT_CLAIMER_DEPLOY_INITIALIZE_SELECTOR;

export default async function payload(
  spaceOwner: string,
  id: string,
  maxSupply: number,
  mintPrice: string,
  proposerFee: number,
  salt: string,
  spaceTreasury: string
) {
  if (proposerFee < 0 || proposerFee > 100) {
    throw new Error('proposerFee should be between 0 and 100');
  }
  validateAddresses({ spaceOwner, spaceTreasury });
  const space = await fetchSpace(id);
  await validateSpace(spaceOwner, space);

  const initializer = getInitializer({
    spaceOwner,
    spaceId: space?.id as string,
    maxSupply,
    mintPrice,
    proposerFee,
    spaceTreasury
  });
  const result = {
    initializer,
    salt,
    abi: new Interface(spaceFactoryAbi).getFunction('deployProxy').format(FormatTypes.full),
    verifyingContract: VERIFYING_CONTRACT,
    implementation: IMPLEMENTATION_ADDRESS,
    signature: await generateSignature(IMPLEMENTATION_ADDRESS, initializer, salt)
  };

  console.debug('Signer', signer.address);
  console.debug('Payload', result);

  return result;
}

function getInitializer(args: {
  spaceId: string;
  maxSupply: number;
  mintPrice: string;
  proposerFee: number;
  spaceTreasury: string;
  spaceOwner: string;
}) {
  const params = [
    args.spaceId,
    '0.1',
    args.maxSupply,
    BigInt(args.mintPrice),
    args.proposerFee,
    getAddress(args.spaceTreasury),
    getAddress(args.spaceOwner)
  ];

  // This encodeFunctionData should ignore the last 4 params compared to
  // the smart contract version
  // TODO Do not forget to remove the last 4 params in the ABI when copy/pasting
  // from the smart contract
  const initializer = new Interface(spaceCollectionAbi).encodeFunctionData('initialize', params);
  const result = `${INITIALIZE_SELECTOR}${initializer.slice(10)}`;

  console.debug('Initializer params', params);

  return result;
}

async function generateSignature(implementation: string, initializer: string, salt: string) {
  const params = {
    domain: {
      name: 'SpaceCollectionFactory',
      version: '0.1',
      chainId: NFT_CLAIMER_NETWORK,
      verifyingContract: VERIFYING_CONTRACT
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
