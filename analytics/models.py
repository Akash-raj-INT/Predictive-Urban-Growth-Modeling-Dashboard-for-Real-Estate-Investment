from django.db import models
from django.utils import timezone


class LocationData(models.Model):
    area_name = models.CharField(max_length=200)
    latitude = models.FloatField()
    longitude = models.FloatField()
    price_per_sqft = models.FloatField(help_text="Price per square foot in USD")
    rental_yield = models.FloatField(help_text="Annual rental yield as percentage (e.g. 5.2 for 5.2%)")
    infra_score = models.FloatField(help_text="Infrastructure score from 0 to 10")
    listing_density = models.FloatField(help_text="Number of active listings in area")
    growth_score = models.FloatField(default=0.0, help_text="Computed growth score (0-10)")
    timestamp = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-growth_score']
        verbose_name = "Location Data"
        verbose_name_plural = "Location Data"

    def __str__(self):
        return f"{self.area_name} (Growth: {self.growth_score:.2f})"

    @staticmethod
    def compute_growth_score(price_per_sqft, rental_yield, infra_score,
                              all_prices=None, all_yields=None, all_infra=None):
        """
        Growth Score = (normalized_price * 0.4) + (normalized_yield * 0.3) + (normalized_infra * 0.3)

        Uses min-max normalization across known dataset ranges.
        Falls back to sensible domain-based normalization if dataset stats not provided.
        """
        # --- Normalize price_per_sqft ---
        if all_prices and len(all_prices) > 1:
            p_min, p_max = min(all_prices), max(all_prices)
            norm_price = (price_per_sqft - p_min) / (p_max - p_min) if p_max != p_min else 0.5
        else:
            # Assume reasonable range $50 - $2000/sqft
            norm_price = min(max((price_per_sqft - 50) / (2000 - 50), 0), 1)

        # --- Normalize rental_yield ---
        if all_yields and len(all_yields) > 1:
            y_min, y_max = min(all_yields), max(all_yields)
            norm_yield = (rental_yield - y_min) / (y_max - y_min) if y_max != y_min else 0.5
        else:
            # Assume reasonable range 1% - 15%
            norm_yield = min(max((rental_yield - 1) / (15 - 1), 0), 1)

        # --- Normalize infra_score (already 0-10 scale) ---
        if all_infra and len(all_infra) > 1:
            i_min, i_max = min(all_infra), max(all_infra)
            norm_infra = (infra_score - i_min) / (i_max - i_min) if i_max != i_min else 0.5
        else:
            norm_infra = min(max(infra_score / 10.0, 0), 1)

        # Weighted sum → scale to 0-10
        score = (norm_price * 0.4) + (norm_yield * 0.3) + (norm_infra * 0.3)
        return round(score * 10, 2)

    def save(self, *args, **kwargs):
        """Auto-compute growth_score before saving."""
        all_prices = list(LocationData.objects.exclude(pk=self.pk).values_list('price_per_sqft', flat=True))
        all_yields = list(LocationData.objects.exclude(pk=self.pk).values_list('rental_yield', flat=True))
        all_infra = list(LocationData.objects.exclude(pk=self.pk).values_list('infra_score', flat=True))

        self.growth_score = self.compute_growth_score(
            self.price_per_sqft, self.rental_yield, self.infra_score,
            all_prices, all_yields, all_infra
        )
        super().save(*args, **kwargs)
