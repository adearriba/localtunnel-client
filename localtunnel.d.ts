/// <reference types="node" />

import { EventEmitter } from 'events';

// Define the Options type used in various constructors
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

interface TunnelCallback {
    (error: Error | null, client?: Tunnel): void;
}

declare class Tunnel extends EventEmitter {
    constructor(opts?: TunnelOptions);
    open(callback: TunnelCallback): void;
    close(): void;
    private _init(callback: (err: Error | null, info?: any) => void): void;
    private _establish(info: any): void;
}

declare function localtunnel(arg1: number | TunnelOptions, arg2?: TunnelCallback | TunnelOptions, arg3?: TunnelCallback): Tunnel | Promise<Tunnel>;

declare class TunnelCluster extends EventEmitter {
    constructor(opts: TunnelOptions);
    open(): void;
}

export { localtunnel, Tunnel, TunnelCluster };
