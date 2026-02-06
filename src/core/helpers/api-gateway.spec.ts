import { describe, expect, test } from 'vitest'
import { extractHttpInfo, isApiGatewayEvent, isApiGatewayV1, isApiGatewayV2 } from './api-gateway';
import type { APIGatewayUnion } from './handler-type';

describe('#api-gateway', () => {
    const apiGatewayPayloads = [
        {
            version: 1,
            matchV1: true,
            matchV2: false,
            data: {
                httpMethod: 'get',
                path: '/v1',
                requestContext: { resourcePath: '/v1' },
            }
        },
        {
            version: 2,
            matchV1: false,
            matchV2: true,
            data: {
                rawPath: '/v2',
                requestContext: { http: { method: 'get' } },
            }
        },
        {
            version: null,
            matchV1: false,
            matchV2: false,
            data: {},
        }
    ];

    test.each(apiGatewayPayloads)('extractHttpInfo(v$version payload) should return valid path and method', (item) => {
        if (item.version === null) {
            expect(() => extractHttpInfo({} as APIGatewayUnion)).toThrowError('Invalid http event');
            return;
        }
        const httpInfo = extractHttpInfo(item.data as APIGatewayUnion);
        expect(httpInfo.httpMethod).toBe('get');
        expect(httpInfo.path).toBeOneOf(['/v1', '/v2']);
    });

    test.each(apiGatewayPayloads)('isApiGatewayV1(v$version payload) should return $matchV1', (payload) => {
        expect(isApiGatewayV1(payload.data)).toBe(payload.version === 1);
    });

    test.each(apiGatewayPayloads)('isApiGatewayV2(v$version payload) should return $matchV2', (payload) => {
        expect(isApiGatewayV2(payload.data)).toBe(payload.version === 2);
    });

    test('isApiGatewayEvent should verify any event comming from api gateway', () => {
        expect(isApiGatewayEvent(apiGatewayPayloads[0]?.data)).toBeTruthy();
        expect(isApiGatewayEvent(apiGatewayPayloads[1]?.data)).toBeTruthy();
        expect(isApiGatewayEvent(apiGatewayPayloads[2]?.data)).toBeFalsy();
    });
});
