"use client";

import { sha224 } from "js-sha256";
import type { CreateMStorageOptions, MStorageItem } from "./types";

export class MStorage
{
    private readonly storage: Storage;
    private readonly encryptKeys: boolean;
    // private readonly encryptValues: boolean;

    constructor(options: CreateMStorageOptions = {}) {
        
        if(options.storage)
        {
            if(typeof window === 'undefined')
            {
                this.storage = undefined as any;
            }
            else 
            {
                if(options.storage === 'local') this.storage = localStorage;
                else if(options.storage === 'session') this.storage = sessionStorage;
                else throw new Error("Invalid storage type");
            }
        }
        else
        {
            if(typeof window === 'undefined')
            {
                this.storage = undefined as any;
            }
            else this.storage = localStorage;
        };
        this.encryptKeys = options.encryptKeys ?? false;
        // this.encryptValues = options.encryptValues ?? false;
    }


    public get(key: string): string | null
    {
        if(typeof window === 'undefined')
            return null;
        return this._getItem(this._getKey(key));
    }

    public set(key: string, value: string, ttl: number = 0)
    {
        if(typeof window === 'undefined')
            return null;
        this._setItem(this._getKey(key), value, ttl);
    }

    public remove(key: string | string[])
    {
        if(typeof window === 'undefined')
            return;
        if(Array.isArray(key))
        {
            for(const k of key)
                this._removeItem(this._getKey(k));
        }
        else this._removeItem(this._getKey(key));
    }

    public clear()
    {
        if(typeof window === 'undefined')
            return;
        this.storage.clear();
    }

    public ttl(key: string): number | null
    {
        if(typeof window === 'undefined')
            return null;
        return this._getTtl(this._getKey(key));
    }

    private _getKey(name: string)
    {
        name = `ms_${name}`;
        return this.encryptKeys ? sha224(name) : name;
    }

    private _getItem(key: string): string | null
    {
        const json = this.storage.getItem(key);
        if(json === null) return null;

        const [value, expire]: MStorageItem = JSON.parse(json);
        if(expire === null) return value;

        const now = Date.now();
        const ttlMs = expire - now;
        if(ttlMs <= 0)
        {
            this._removeItem(key);
            return null;
        }

        return value;
    }


    private _getTtl(key: string): number | null
    {
        const json = this.storage.getItem(key);
        if(json === null) return null;

        const [, expire]: MStorageItem = JSON.parse(json);
        if(expire === null) return Infinity;

        const now = Date.now();
        const ttlMs = expire - now;
        if(ttlMs <= 0)
        {
            this._removeItem(key);
            return null;
        }

        return Math.round(ttlMs / 1000);
    }

    private _setItem(key: string, value: string, ttl: number = 0)
    {
        const expire = ttl > 0 ? Date.now() + (ttl * 1000) : null;
        const data: MStorageItem = [value, expire];
        this.storage.setItem(key, JSON.stringify(data));
    }

    private _removeItem(key: string)
    {
        this.storage.removeItem(key);
    }
}