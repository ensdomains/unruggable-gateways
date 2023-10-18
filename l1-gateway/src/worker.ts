import { Server } from '@ensdomains/ccip-read-cf-worker';

interface Env {
  WORKER_PROVIDER_URL: string
}
interface Router{
  handle:(request:Request)=> void
}
let app:Router
async function fetch(request:Request, env:Env){
  // Loading libraries dynamically as a temp work around.
  // Otherwise, deployment thorws "Error: Script startup exceeded CPU time limit." error
  if(!app){
    const ethers = await import('ethers');
    const EVMGateway = (await import('@ensdomains/evm-gateway')).EVMGateway
    const L1ProofService = (await import('./L1ProofService.js')).L1ProofService;
    const { WORKER_PROVIDER_URL } = env;
    const provider = new ethers.JsonRpcProvider(WORKER_PROVIDER_URL);
    const gateway = new EVMGateway(new L1ProofService(provider));
    const server = new Server();
    gateway.add(server);
    app = server.makeApp("/")  
  }
  return app.handle(request)
}

export default {
	fetch,
};
