/// <reference types="node" />
import { EventEmitter } from 'events';

// Define the options and other types used in the class
interface TunnelOptions {
    host?: string;
    subdomain?: string;
    api_key?: string;
    local_https?: boolean;
    local_cert?: string;
    local_key?: string;
    local_ca?: string;
    allow_invalid_cert?: boolean;
    remote_ip?: string;
    remote_port?: number;
    local_host?: string;
    local_port?: number;
}

interface TunnelInfo {
    name: string;
    url: string;
    cached_url?: string;
    max_conn: number;
    remote_host: string;
    remote_ip: string;
    remote_port: number;
    local_port: number;
    local_host: string;
    local_https: boolean;
    local_cert?: string;
    local_key?: string;
    local_ca?: string;
    allow_invalid_cert: boolean;
}

type TunnelCallback = (error: Error | null, client?: Tunnel) => void;

class Tunnel extends EventEmitter {
    private _url: string;
    private opts: TunnelOptions;
    private closed: boolean;
    private tunnelCluster: TunnelCluster; // Use the correct type

    constructor(opts?: TunnelOptions);
    private _getInfo(body: any): TunnelInfo;
    private _init(cb: TunnelCallback): void;
    private _establish(info: TunnelInfo): void;

    get url(): string;
    open(cb: TunnelCallback): void;
    close(): void;
}

function localtunnel(arg1: number | TunnelOptions, arg2?: TunnelCallback | TunnelOptions, arg3?: TunnelCallback): Tunnel | Promise<Tunnel>;

class TunnelCluster extends EventEmitter {
    constructor(opts: TunnelOptions);
    open(): void;
}

export default localtunnel;
export { Tunnel, TunnelCluster, TunnelOptions, TunnelInfo, TunnelCallback };
