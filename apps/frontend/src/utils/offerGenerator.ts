export const generatePersonalOfferLink = (
    leadId: string,
    discount: number,
    initialPayment?: number | null,
    selectedIds?: string | null
): string => {
    const params = new URLSearchParams();
    params.set('uuid', leadId);
    params.set('offerDiscount', discount.toString());

    if (initialPayment) {
        params.set('initialPayment', initialPayment.toString());
    }

    if (selectedIds) {
        params.set('selectedIds', selectedIds);
    }

    // Encode to Base64URL
    const encoded = btoa(params.toString())
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

    return `${window.location.origin}/?offer=${encoded}`;
};
