import fs from 'node:fs';
import path from 'node:path';
import { render } from '@testing-library/react';
import DOMPurify from 'dompurify';
import { expect, it } from 'vitest';
import { Markdown } from '../src/components/atomic-crm/misc/Markdown';

it('pins every installed DOMPurify copy to reviewed 3.4.16', () => {
    expect(DOMPurify.version).toBe('3.4.16');
    const lock = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../package-lock.json'), 'utf8'));
    expect(lock.packages[''].dependencies.dompurify).toBe('3.4.16');
    for (const [name, entry] of Object.entries(lock.packages) as [string, { version: string }][]) {
        if (name.endsWith('node_modules/dompurify')) expect(entry.version).toBe('3.4.16');
    }
});

it('keeps rawtext and detached-subtree-shaped Markdown inert after hardening', () => {
    const { container } = render(<Markdown>{'**Kept formatting**\n\n<style></style><img src=x onerror=alert(1)></style>\n\n<footer><img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" onload="alert(1)"></footer>\n\n[Inert link](javascript:alert(1))\n\n<span data-x="1" style="color:red" onclick="alert(1)">Text</span>'}</Markdown>);
    const content = container.firstElementChild!;
    expect(content.querySelector('strong')?.textContent).toBe('Kept formatting');
    expect(content.querySelector('style,script,img,footer,a,iframe,svg,math')).toBeNull();
    for (const node of content.querySelectorAll('*')) expect(node.attributes.length).toBe(0);
    expect(content.textContent).toContain('Inert link');
});
