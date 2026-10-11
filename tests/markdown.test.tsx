import {render,screen} from '@testing-library/react';
import {describe,it,expect} from 'vitest';
import {Markdown} from '../src/components/atomic-crm/misc/Markdown';
describe('Room markdown safety',()=>{
 it('renders formatting without external URL/image or HTML resource sinks',()=>{const {container}=render(<Markdown>{'**Useful** [Website](https://example.com) ![remote](https://example.com/image.png) <img src="https://example.com/x" onerror="alert(1)"><iframe src="https://example.com"></iframe><video poster="https://example.com/p"></video><a href="mailto:x@example.com">Email</a><p style="background:url(https://example.com/x)">Note</p>'}</Markdown>);expect(screen.getByText('Useful').tagName).toBe('STRONG');expect(screen.getByText(/Website/)).toBeInTheDocument();expect(container.querySelector('a,img,iframe,video,style,script,link,object,svg')).toBeNull();expect(container.querySelector('[style],[href],[src],[srcset],[onerror]')).toBeNull();});
 it('keeps code and inert script text safely',()=>{const {container}=render(<Markdown>{'```html\n<script>alert(1)</script>\n```'}</Markdown>);expect(container.querySelector('script')).toBeNull();expect(container.querySelector('code')?.textContent).toContain('<script>');});
});
