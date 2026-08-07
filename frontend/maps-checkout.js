/* Optional Google Maps enhancement. The checkout remains usable when no browser key is configured. */
(async () => {
  const fields = {
    address: document.getElementById("customerAddress"),
    city: document.getElementById("customerCity"),
    postal: document.getElementById("customerPincode"),
  };
  if (!fields.address) return;
  const apiOrigin = new URL("http://localhost:5000/api", window.location.href).origin;
  const config = await fetch(`${apiOrigin}/api/config/public`)
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  if (!config?.googleMapsKey) return;
  const script = document.createElement("script");
  script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(config.googleMapsKey)}&libraries=places`;
  script.async = true;
  script.onload = () => {
    const autocomplete = new google.maps.places.Autocomplete(fields.address, {
      types: ["address"],
    });
    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace(),
        parts = {};
      (place.address_components || []).forEach((x) =>
        x.types.forEach((t) => (parts[t] = x.long_name)),
      );
      fields.city.value =
        parts.locality ||
        parts.administrative_area_level_2 ||
        fields.city.value;
      fields.postal.value = parts.postal_code || fields.postal.value;
      let lat = document.getElementById("deliveryLatitude"),
        lng = document.getElementById("deliveryLongitude");
      if (!lat) {
        lat = document.createElement("input");
        lat.type = "hidden";
        lat.id = "deliveryLatitude";
        fields.address.form.append(lat);
        lng = document.createElement("input");
        lng.type = "hidden";
        lng.id = "deliveryLongitude";
        fields.address.form.append(lng);
      }
      lat.value = place.geometry?.location?.lat() || "";
      lng.value = place.geometry?.location?.lng() || "";
    });
  };
  document.head.append(script);
})();
