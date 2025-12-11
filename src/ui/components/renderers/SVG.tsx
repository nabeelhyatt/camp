interface SVGPreviewProps {
    content: string;
}

export function SVGPreview({ content }: SVGPreviewProps) {
    return (
        <div
            className="bg-background"
            dangerouslySetInnerHTML={{ __html: content }}
        />
    );
}
